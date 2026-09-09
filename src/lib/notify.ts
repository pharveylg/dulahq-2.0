import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export type NotifyInput = {
  playerId: string;
  template: string;
  /** Must include title/body -- the schema stores template+payload rather
   * than rendered text (so a future template registry could re-render
   * historical rows), but Phase 5a doesn't build that registry yet since
   * nothing calls notify() with a real template until Phase 5c wires the
   * actual trigger points. Until then, the caller writes its own copy. */
  payload: Record<string, unknown> & { title: string; body: string };
  /** Defaults to '/guardian' for a minor's targets and '/player' for an
   * adult's own account -- override only when a more specific page exists
   * for this template (e.g. a tournament roster's own tab). */
  linkPath?: string;
  /** development_goals/player_evaluations/player_development_notes' own
   * visibility column ('coach_only'|'staff'|'player'|'parent'|
   * 'player_and_parent') -- when given, the notification is skipped
   * entirely unless the resolved audience (guardian for a minor, the
   * player themself for an adult) is one the row is actually visible to.
   * Mirrors the read-RLS predicate exactly (phase6b/6c) so nobody gets
   * notified about something that opens to a blank page for them. */
  visibility?: string;
};

/**
 * Phase 5a's notification core (CLAUDE.md §0c). Resolves who actually
 * receives a player-related notification -- age-gated exactly like
 * Phase 3's tournament consent (requires_guardian_consent(), same <18
 * threshold, deliberately not a separate rule) -- then writes the
 * notifications row (channel='in_app', the durable record the future
 * inbox reads) and best-effort sends a push to whatever devices are
 * subscribed for that recipient.
 *
 * Minor: every guardian link where the effective receive_notifications
 * permission is true (default bundle, overridden per guardian_permission_grants
 * -- same effective-permission computation as PlayerProfile.tsx's Family
 * tab, just resolved for a target player_guardian_id instead of the
 * current session). Adult: the player's own linked account, if any --
 * nobody is notified if an adult has no account, since there's no
 * "player module" to surface it in.
 *
 * orgId is derived from the player row rather than taken as a caller
 * argument -- every Phase 5c trigger site already has a playerId in hand,
 * and deriving it here means one less thing for those call sites to fetch
 * or thread through.
 */
export async function notifyAboutPlayer({ playerId, template, payload, linkPath, visibility }: NotifyInput) {
  const supabase = await createClient();

  const { data: player } = await supabase.from('players').select('org_id, user_id').eq('id', playerId).maybeSingle();
  if (!player) return { notified: 0 };
  const orgId = player.org_id;

  const { data: isMinorData } = await supabase.rpc('requires_guardian_consent', { p_player_id: playerId });
  const isMinor = !!isMinorData;
  const resolvedLinkPath = linkPath ?? (isMinor ? '/guardian' : '/player');

  if (visibility) {
    const visibleTo = isMinor ? ['player_and_parent', 'parent'] : ['player_and_parent', 'player'];
    if (!visibleTo.includes(visibility)) return { notified: 0 };
  }

  const targets: { userId: string | null; guardianId: string | null }[] = [];

  if (isMinor) {
    const { data: links } = await supabase
      .from('player_guardians')
      .select('id, guardian_id, guardians(user_id)')
      .eq('player_id', playerId);

    if (links && links.length > 0) {
      const linkIds = links.map((l) => l.id);
      const [{ data: defaultRow }, { data: overrides }] = await Promise.all([
        supabase.from('guardian_permission_defaults').select('permission_key').eq('permission_key', 'receive_notifications').maybeSingle(),
        supabase
          .from('guardian_permission_grants')
          .select('player_guardian_id, granted')
          .eq('permission_key', 'receive_notifications')
          .in('player_guardian_id', linkIds),
      ]);
      const defaultGrants = !!defaultRow;
      const overrideByLink = new Map((overrides ?? []).map((o) => [o.player_guardian_id, o.granted]));

      for (const link of links) {
        const effective = overrideByLink.has(link.id) ? overrideByLink.get(link.id)! : defaultGrants;
        if (effective) {
          targets.push({ userId: (link as any).guardians?.user_id ?? null, guardianId: link.guardian_id });
        }
      }
    }
  } else if (player.user_id) {
    targets.push({ userId: player.user_id, guardianId: null });
  }

  for (const target of targets) {
    if (!target.userId && !target.guardianId) continue;

    // A plain insert().select() here would need the *caller* (the staff
    // member raising the fee, posting the note, etc.) to also satisfy
    // notifications_read_own's SELECT policy on the row it just wrote --
    // which only the recipient or an org_admin can. create_notification()
    // is SECURITY DEFINER specifically so a non-admin coach can notify
    // someone else without that RETURNING-triggers-a-read-check trap
    // silently rolling the whole insert back (found live: the fee-charge
    // trigger created the charge but wrote zero notification rows).
    const { data: notificationId, error } = await supabase.rpc('create_notification', {
      p_org_id: orgId,
      p_recipient_user_id: target.userId,
      p_recipient_guardian_id: target.guardianId,
      p_channel: 'in_app',
      p_template: template,
      p_payload: payload as unknown as Record<string, string | number | boolean | null>,
      p_link_path: resolvedLinkPath,
    });
    if (error) {
      console.error('notifyAboutPlayer: create_notification failed', error);
      continue;
    }

    if (target.userId) {
      await sendPush(orgId, target.userId, payload.title, payload.body, resolvedLinkPath, notificationId ?? undefined);
    }
  }

  return { notified: targets.length };
}

export type NotifyStaffInput = {
  clubId: string;
  orgId: string;
  /** A staff permission key (permissions.category='staff') -- resolved via
   *  staff_holding_permission(), the same eligibility logic
   *  has_staff_permission() uses, just enumerating everyone who holds it
   *  instead of checking one caller. */
  permissionKey: string;
  /** Narrows a team-scope permission to one team's assigned staff (still
   *  club-wide staff too, e.g. club_manager) -- omit for a club-scope key. */
  teamId?: string;
  template: string;
  payload: Record<string, unknown> & { title: string; body: string };
  linkPath?: string;
};

/**
 * P1-8 (gap analysis §5): the staff-facing counterpart to
 * notifyAboutPlayer() -- nothing before this could tell a coach or team
 * manager anything at all; the only inbound channel was reading
 * Announcements on the chance they thought to look. Resolves recipients
 * via staff_holding_permission() rather than iterating club_staff and
 * calling has_staff_permission() once per row -- that function is keyed to
 * auth.uid(), so it can only ever answer "does the *caller* hold this",
 * never "does person X".
 */
export async function notifyStaff({ clubId, orgId, permissionKey, teamId, template, payload, linkPath }: NotifyStaffInput) {
  const supabase = await createClient();

  const { data: recipientIds, error: resolveError } = await supabase.rpc('staff_holding_permission', {
    p_club_id: clubId,
    p_permission_key: permissionKey,
    p_team_id: teamId ?? null,
  });
  if (resolveError) {
    console.error('notifyStaff: staff_holding_permission failed', resolveError);
    return { notified: 0 };
  }

  for (const userId of recipientIds ?? []) {
    const { data: notificationId, error } = await supabase.rpc('create_notification', {
      p_org_id: orgId,
      p_recipient_user_id: userId,
      p_recipient_guardian_id: null,
      p_channel: 'in_app',
      p_template: template,
      p_payload: payload as unknown as Record<string, string | number | boolean | null>,
      p_link_path: linkPath ?? null,
    });
    if (error) {
      console.error('notifyStaff: create_notification failed', error);
      continue;
    }
    await sendPush(orgId, userId, payload.title, payload.body, linkPath, notificationId ?? undefined);
  }

  return { notified: (recipientIds ?? []).length };
}

async function sendPush(orgId: string, userId: string, title: string, body: string, linkPath: string | undefined, notificationRowId: string | undefined) {
  ensureVapid();
  if (!vapidConfigured) return;

  const supabase = await createClient();
  const { data: subs } = await supabase.rpc('push_subscription_targets', { p_org_id: orgId, p_user_id: userId });
  if (!subs || subs.length === 0) return;

  const message = JSON.stringify({ title, body, linkPath });
  let anyFailed = false;

  await Promise.all(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, message);
      } catch (err: any) {
        anyFailed = true;
        // 410/404 means the browser dropped this subscription -- clean it up
        // rather than retrying a dead endpoint forever. The subscription
        // belongs to the recipient, not this (staff) caller, so the
        // self-only RLS on push_subscriptions needs the same SECURITY
        // DEFINER escape hatch as create_notification above.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.rpc('delete_stale_push_subscription', { p_endpoint: sub.endpoint });
        }
      }
    })
  );

  if (notificationRowId) {
    await supabase.rpc('mark_notification_sent', {
      p_notification_id: notificationRowId,
      p_failed_reason: anyFailed ? 'one or more push endpoints failed' : null,
    });
  }
}

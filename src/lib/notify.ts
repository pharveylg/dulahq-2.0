import 'server-only';
import webpush from 'web-push';
import { serviceClient } from '@/lib/admin-auth';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationWriteInput = {
  orgId: string;
  recipientUserId?: string | null;
  recipientGuardianId?: string | null;
  template: string;
  payload: Record<string, unknown> & { title: string; body: string };
  linkPath?: string | null;
};

function tryServiceClient() {
  try {
    return serviceClient();
  } catch (error) {
    console.error('Notification service client is unavailable', error);
    return null;
  }
}

function normalizeIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return Array.from(new Set(data.map((value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const row = value as Record<string, unknown>;
      const candidate = row.user_id ?? row.id ?? Object.values(row)[0];
      return typeof candidate === 'string' ? candidate : null;
    }
    return null;
  }).filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))));
}

async function resolvePlatformAdminIds(admin: ReturnType<typeof serviceClient>): Promise<string[]> {
  const { data, error } = await (admin as any).rpc('platform_admin_user_ids');
  if (!error) return normalizeIds(data);

  // Compatibility fallback for a branch that has not yet received the helper
  // migration. This remains server-only and uses the service-role client.
  const [{ data: assignments }, { data: legacyAdmins }, { data: users }] = await Promise.all([
    admin.from('role_assignments').select('user_id').eq('scope_type', 'platform').eq('role', 'platform_admin'),
    admin.from('platform_admins').select('email'),
    admin.from('users').select('id, email'),
  ]);
  const emails = new Set((legacyAdmins ?? []).map((row: any) => String(row.email).toLowerCase()));
  const legacyIds = (users ?? [])
    .filter((row: any) => row.email && emails.has(String(row.email).toLowerCase()))
    .map((row: any) => row.id as string);
  return Array.from(new Set([
    ...(assignments ?? []).map((row: any) => row.user_id as string),
    ...legacyIds,
  ].filter((id) => typeof id === 'string' && UUID_RE.test(id))));
}

async function isRecipientAuthorized(
  admin: ReturnType<typeof serviceClient>,
  input: Pick<NotificationWriteInput, 'orgId' | 'recipientUserId' | 'recipientGuardianId' | 'template'>,
  platformAdminIds?: Set<string>,
): Promise<boolean> {
  if (!input.orgId) return false;

  if (input.recipientGuardianId) {
    const { data: guardian } = await admin
      .from('guardians')
      .select('id')
      .eq('id', input.recipientGuardianId)
      .eq('org_id', input.orgId)
      .maybeSingle();
    if (!guardian) return false;
  }

  if (!input.recipientUserId) return !!input.recipientGuardianId;

  const { data: belongsToOrg, error: membershipError } = await (admin as any).rpc('is_user_in_org', {
    p_user_id: input.recipientUserId,
    p_org_id: input.orgId,
  });
  if (!membershipError && belongsToOrg) return true;

  // A newly provisioned account has a scoped login record before it has a
  // club_staff/tournament_staff relationship. Permit only those login-event
  // templates when that server-created record belongs to this organization.
  if (input.template === 'login.created' || input.template === 'login.reissued') {
    const { data: provisionedLogin } = await admin
      .from('provisioned_logins')
      .select('user_id')
      .eq('user_id', input.recipientUserId)
      .eq('owner_org_id', input.orgId)
      .maybeSingle();
    if (provisionedLogin) return true;
  }

  // Officials are a tournament-scoped recipient type, not an org-membership
  // row. Only allow them when the official is actually assigned in this org.
  const { data: official } = await admin
    .from('org_officials')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('user_id', input.recipientUserId)
    .limit(1)
    .maybeSingle();
  if (official) {
    const { data: assignment } = await admin
      .from('tournament_officials')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('official_id', official.id)
      .limit(1)
      .maybeSingle();
    if (assignment) return true;
  }

  const platformIds = platformAdminIds ?? new Set(await resolvePlatformAdminIds(admin));
  return platformIds.has(input.recipientUserId);
}

async function insertNotificationWithServiceRole(
  admin: ReturnType<typeof serviceClient>,
  input: NotificationWriteInput,
  platformAdminIds?: Set<string>,
): Promise<string | null> {
  try {
    if (!input.recipientUserId && !input.recipientGuardianId) return null;
    if (!(await isRecipientAuthorized(admin, input, platformAdminIds))) {
      console.error('Notification write refused: recipient is not in the notification scope');
      return null;
    }

    const { data, error } = await admin
      .from('notifications')
      .insert({
        org_id: input.orgId,
        recipient_user_id: input.recipientUserId ?? null,
        recipient_guardian_id: input.recipientGuardianId ?? null,
        channel: 'in_app',
        template: input.template,
        payload: input.payload as any,
        link_path: input.linkPath ?? null,
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('Notification insert failed', error);
      return null;
    }
    return data.id as string;
  } catch (error) {
    console.error('Notification insert failed', error);
    return null;
  }
}

export type NotifyInput = {
  playerId: string;
  template: string;
  /** Must include title/body. The persisted payload is used by the inbox and
   * by the server-side push dispatcher; template remains the stable event key. */
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

export type NotifyUserInput = {
  orgId: string;
  recipientUserId: string;
  template:
    | 'support.request.platform_reply'
    | 'tournament.official.assigned'
    | 'login.created'
    | 'login.reissued';
  payload: { title: string; body: string };
  linkPath?: string;
};

export type NotifyPlatformAdminsInput = {
  orgId: string;
  template: 'support.request.created' | 'support.request.reply';
  payload: { title: string; body: string };
  linkPath?: string;
};

/**
 * Create a notification for one recipient already identified by an
 * authorization-scoped server action. The service-role insert is guarded
 * again here by checking the recipient's org relationship (or a current
 * tournament-official assignment); this module is server-only.
 */
export async function notifyUser(input: NotifyUserInput) {
  try {
    const admin = tryServiceClient();
    if (!admin) return { notified: 0 };

    const notificationId = await insertNotificationWithServiceRole(admin, input);
    if (!notificationId) return { notified: 0 };
    await sendPushForNotification(notificationId);
    return { notified: 1, notificationId };
  } catch (error) {
    console.error('notifyUser failed', error);
    return { notified: 0 };
  }
}

/** Notify the platform-admin roster without exposing admin IDs to clients. */
export async function notifyPlatformAdmins(input: NotifyPlatformAdminsInput) {
  try {
    const admin = tryServiceClient();
    if (!admin) return { notified: 0 };

    const adminIds = await resolvePlatformAdminIds(admin);
    const allowedAdminIds = new Set(adminIds);
    let notified = 0;
    for (const recipientUserId of adminIds) {
      const notificationId = await insertNotificationWithServiceRole(
        admin,
        { ...input, recipientUserId },
        allowedAdminIds,
      );
      if (!notificationId) continue;
      notified += 1;
      await sendPushForNotification(notificationId);
    }
    return { notified };
  } catch (error) {
    console.error('notifyPlatformAdmins failed', error);
    return { notified: 0 };
  }
}

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

  const admin = tryServiceClient();
  if (!admin) return { notified: 0 };

  let notified = 0;
  for (const target of targets) {
    if (!target.userId && !target.guardianId) continue;

    const notificationId = await insertNotificationWithServiceRole(admin, {
      orgId,
      recipientUserId: target.userId,
      recipientGuardianId: target.guardianId,
      template,
      payload,
      linkPath: resolvedLinkPath,
    });
    if (!notificationId) continue;

    notified += 1;
    await sendPushForNotification(notificationId);
  }

  return { notified };
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
  const admin = tryServiceClient();
  if (!admin) return { notified: 0 };

  // Keep the recipient resolver private and make sure the caller did not pair
  // a club with a different organization when invoking this server helper.
  const { data: club } = await admin.from('clubs').select('org_id').eq('id', clubId).maybeSingle();
  if (!club || club.org_id !== orgId) {
    console.error('notifyStaff refused: club/org scope mismatch');
    return { notified: 0 };
  }

  const { data: recipientIds, error: resolveError } = await (admin as any).rpc('staff_holding_permission', {
    p_club_id: clubId,
    p_permission_key: permissionKey,
    p_team_id: teamId ?? null,
  });
  if (resolveError) {
    console.error('notifyStaff: staff_holding_permission failed', resolveError);
    return { notified: 0 };
  }

  let notified = 0;
  for (const userId of (recipientIds ?? []) as string[]) {
    const notificationId = await insertNotificationWithServiceRole(admin, {
      orgId,
      recipientUserId: userId,
      template,
      payload,
      linkPath: linkPath ?? null,
    });
    if (!notificationId) continue;

    notified += 1;
    await sendPushForNotification(notificationId);
  }

  return { notified };
}

/**
 * Server-side push dispatcher. Its sole argument is a notification ID; the
 * recipient, content, link, and organization are always read from that row.
 * Subscription secrets never cross an authenticated RPC boundary.
 */
export async function sendPushForNotification(notificationId: string) {
  try {
    await dispatchPushForNotification(notificationId);
  } catch (error) {
    console.error('Push dispatch failed', error);
  }
}

async function dispatchPushForNotification(notificationId: string) {
  if (!UUID_RE.test(notificationId)) return;

  try {
    ensureVapid();
  } catch (error) {
    console.error('Push VAPID configuration is invalid', error);
    return;
  }
  if (!vapidConfigured) return;

  const admin = tryServiceClient();
  if (!admin) return;

  const { data: notification, error: notificationError } = await admin
    .from('notifications')
    .select('id, recipient_user_id, channel, payload, link_path, sent_at')
    .eq('id', notificationId)
    .maybeSingle();
  if (notificationError || !notification) {
    if (notificationError) console.error('Push dispatch could not read notification', notificationError);
    return;
  }
  if (notification.channel !== 'in_app' || !notification.recipient_user_id || notification.sent_at) return;

  const payload = notification.payload as any;
  const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 120) : '';
  const body = typeof payload?.body === 'string' ? payload.body.trim().slice(0, 240) : '';
  if (!title || !body) return;

  const linkPath = safePushLink(notification.link_path);
  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', notification.recipient_user_id);
  if (subscriptionError) {
    console.error('Push dispatch could not read recipient subscriptions', subscriptionError);
    return;
  }
  if (!subscriptions?.length) return;

  const message = JSON.stringify({ title, body, linkPath });
  let anyFailed = false;

  await Promise.all(subscriptions.map(async (subscription: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
        message,
      );
    } catch (error: any) {
      anyFailed = true;
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        const { error: deleteError } = await admin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint)
          .eq('user_id', notification.recipient_user_id);
        if (deleteError) console.error('Push dispatch could not remove a stale subscription', deleteError);
      }
    }
  }));

  const update = anyFailed
    ? { failed_reason: 'one or more push endpoints failed' }
    : { sent_at: new Date().toISOString(), failed_reason: null };
  const { error: updateError } = await admin
    .from('notifications')
    .update(update)
    .eq('id', notification.id)
    .eq('recipient_user_id', notification.recipient_user_id);
  if (updateError) console.error('Push dispatch could not record delivery status', updateError);
}

function safePushLink(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

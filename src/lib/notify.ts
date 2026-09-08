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
  orgId: string;
  playerId: string;
  template: string;
  /** Must include title/body -- the schema stores template+payload rather
   * than rendered text (so a future template registry could re-render
   * historical rows), but Phase 5a doesn't build that registry yet since
   * nothing calls notify() with a real template until Phase 5c wires the
   * actual trigger points. Until then, the caller writes its own copy. */
  payload: Record<string, unknown> & { title: string; body: string };
  linkPath?: string;
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
 */
export async function notifyAboutPlayer({ orgId, playerId, template, payload, linkPath }: NotifyInput) {
  const supabase = await createClient();

  const { data: isMinorData } = await supabase.rpc('requires_guardian_consent', { p_player_id: playerId });
  const isMinor = !!isMinorData;

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
  } else {
    const { data: player } = await supabase.from('players').select('user_id').eq('id', playerId).maybeSingle();
    if (player?.user_id) targets.push({ userId: player.user_id, guardianId: null });
  }

  for (const target of targets) {
    if (!target.userId && !target.guardianId) continue;

    const { data: row } = await supabase
      .from('notifications')
      .insert({
        org_id: orgId,
        recipient_user_id: target.userId,
        recipient_guardian_id: target.guardianId,
        channel: 'in_app',
        template,
        payload: payload as unknown as Record<string, string | number | boolean | null>,
        link_path: linkPath ?? null,
      })
      .select('id')
      .single();

    if (target.userId) {
      await sendPush(orgId, target.userId, payload.title, payload.body, linkPath, row?.id);
    }
  }

  return { notified: targets.length };
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
        // rather than retrying a dead endpoint forever.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    })
  );

  if (notificationRowId) {
    await supabase
      .from('notifications')
      .update(anyFailed ? { failed_reason: 'one or more push endpoints failed' } : { sent_at: new Date().toISOString() })
      .eq('id', notificationRowId);
  }
}

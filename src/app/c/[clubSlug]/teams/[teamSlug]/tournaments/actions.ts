'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('insufficient_privilege')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * "Submit Roster" collapses the spec's separate Fill/Request-acknowledgement/
 * Finalize steps into one action, deliberately: there's nowhere to persist
 * an in-progress "coach selected but not yet submitted" candidate list
 * (no draft-roster table exists, and adding one is out of scope for this
 * pass), so every visit reconstructs state from what IS persisted --
 * approval_requests and tournament_roster. Selecting a player and hitting
 * "Submit" here:
 *
 * 1. Creates an approval_requests row (status='awaiting') for any selected
 *    minor who doesn't already have a live one for this entry -- adults
 *    (requires_guardian_consent() false) skip this entirely.
 * 2. Immediately calls port_squad_to_tournament() with the full selection.
 *    Adults and any already-approved minors port right away; a minor whose
 *    request was *just* created in step 1 comes back 'consent_missing' --
 *    not an error, just not portable yet. The coach (or whoever revisits
 *    this page once a guardian has responded) re-selects that player and
 *    hits Submit again once their status shows Approved.
 */
export async function submitRoster(entryId: string, orgId: string, playerIds: string[]) {
  if (playerIds.length === 0) return { error: 'Select at least one player.' };
  const supabase = await createClient();
  const dulaUser = await getCurrentDulaUser();

  // requires_guardian_consent is single-player only -- call it per player.
  const needsConsent: Record<string, boolean> = {};
  for (const playerId of playerIds) {
    const { data } = await supabase.rpc('requires_guardian_consent', { p_player_id: playerId });
    needsConsent[playerId] = !!data;
  }

  const minorIds = playerIds.filter((id) => needsConsent[id]);
  let noGuardianCount = 0;

  if (minorIds.length > 0) {
    const { data: existing } = await supabase
      .from('approval_requests')
      .select('player_id, status')
      .eq('subject_type', 'tournament_roster')
      .eq('subject_id', entryId)
      .in('player_id', minorIds);

    const liveStatuses = new Set(['draft', 'awaiting', 'approved']);
    const alreadyLive = new Set((existing ?? []).filter((r) => liveStatuses.has(r.status)).map((r) => r.player_id));
    const needsNewRequest = minorIds.filter((id) => !alreadyLive.has(id));

    if (needsNewRequest.length > 0) {
      const { data: guardianLinks } = await supabase
        .from('player_guardians')
        .select('player_id, guardian_id, is_primary_contact')
        .in('player_id', needsNewRequest)
        .order('is_primary_contact', { ascending: false });

      const guardianByPlayer = new Map<string, string>();
      for (const link of guardianLinks ?? []) {
        if (!guardianByPlayer.has(link.player_id)) guardianByPlayer.set(link.player_id, link.guardian_id);
      }

      const rows = needsNewRequest
        .filter((playerId) => guardianByPlayer.has(playerId))
        .map((playerId) => ({
          org_id: orgId,
          subject_type: 'tournament_roster' as const,
          subject_id: entryId,
          player_id: playerId,
          approver_guardian_id: guardianByPlayer.get(playerId),
          status: 'awaiting' as const,
          requested_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: dulaUser?.id,
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('approval_requests').insert(rows);
        if (insertError) return { error: friendlyError(insertError) };
      }

      noGuardianCount = needsNewRequest.filter((id) => !guardianByPlayer.has(id)).length;
      if (noGuardianCount === playerIds.length) {
        return { error: 'None of the selected players have a guardian on file to ask for consent.' };
      }
    }
  }

  const { data: portResults, error: portError } = await supabase.rpc('port_squad_to_tournament', {
    p_entry_id: entryId,
    p_player_ids: playerIds,
  });
  if (portError) return { error: friendlyError(portError) };

  const ported = (portResults ?? []).filter((r: any) => r.outcome === 'ported').length;
  const pending = (portResults ?? []).filter((r: any) => r.outcome === 'consent_missing').length - noGuardianCount;

  const parts: string[] = [];
  if (ported > 0) parts.push(`${ported} player${ported === 1 ? '' : 's'} added to the roster`);
  if (pending > 0) parts.push(`${pending} still awaiting guardian confirmation`);
  if (noGuardianCount > 0) parts.push(`${noGuardianCount} player${noGuardianCount === 1 ? '' : 's'} can't be asked yet — no guardian on file`);
  if (parts.length === 0) parts.push('Nothing changed.');

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true, message: parts.join('. ') + '.' };
}

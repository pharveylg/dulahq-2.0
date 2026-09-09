'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import { notifyAboutPlayer } from '@/lib/notify';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('insufficient_privilege')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

async function tournamentLabelFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string
) {
  const { data } = await supabase
    .from('tournament_entries')
    .select('tournaments(name), tournament_categories(name)')
    .eq('id', entryId)
    .maybeSingle();
  return (
    [(data as any)?.tournaments?.name, (data as any)?.tournament_categories?.name]
      .filter(Boolean)
      .join(' · ') || 'the tournament'
  );
}

/**
 * Phase C (CLAUDE.md §0f) replaced Phase 3's single "Submit Roster" click
 * with the three stages the workflow actually has, so each one is
 * observable. Nobody is gated differently than before -- the product
 * decision was visibility, not enforcement -- these are just the same two
 * underlying operations (create approval_requests, then
 * port_squad_to_tournament) fired when someone means to fire them, against
 * a proposal that now persists.
 */

/** Stage 1 -- propose. Persists the selection so a second person can pick it up. */
export async function addRosterCandidates(entryId: string, orgId: string, playerIds: string[]) {
  if (playerIds.length === 0) return { error: 'Choose at least one player.' };
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('tournament_roster_candidates').insert(
    playerIds.map((playerId) => ({
      org_id: orgId,
      entry_id: entryId,
      player_id: playerId,
      added_by: dulaUser?.id,
    }))
  );
  // A duplicate just means someone already proposed them; not an error worth
  // showing.
  if (error && error.code !== '23505') return { error: friendlyError(error) };

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function removeRosterCandidate(entryId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tournament_roster_candidates')
    .delete()
    .eq('entry_id', entryId)
    .eq('player_id', playerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Stage 2 -- ask the guardians. Creates an approval_requests row for every
 * proposed minor who doesn't already have a live one. Adults are skipped
 * (requires_guardian_consent() false); a minor with no guardian on file
 * can't be asked at all and is reported back rather than silently dropped.
 */
export async function requestAcknowledgements(entryId: string, orgId: string) {
  const supabase = await createClient();
  const dulaUser = await getCurrentDulaUser();

  const { data: candidateRows } = await supabase
    .from('tournament_roster_candidates')
    .select('player_id')
    .eq('entry_id', entryId);
  const playerIds = (candidateRows ?? []).map((c) => c.player_id);
  if (playerIds.length === 0) return { error: 'Propose some players first.' };

  const needsConsent: Record<string, boolean> = {};
  for (const playerId of playerIds) {
    const { data } = await supabase.rpc('requires_guardian_consent', { p_player_id: playerId });
    needsConsent[playerId] = !!data;
  }
  const minorIds = playerIds.filter((id) => needsConsent[id]);
  if (minorIds.length === 0) return { success: true, message: 'No minors proposed — nothing to ask.' };

  const { data: existing } = await supabase
    .from('approval_requests')
    .select('player_id, status')
    .eq('subject_type', 'tournament_roster')
    .eq('subject_id', entryId)
    .in('player_id', minorIds);

  const liveStatuses = new Set(['draft', 'awaiting', 'approved']);
  const alreadyLive = new Set((existing ?? []).filter((r) => liveStatuses.has(r.status)).map((r) => r.player_id));
  const needsNewRequest = minorIds.filter((id) => !alreadyLive.has(id));
  if (needsNewRequest.length === 0) return { success: true, message: 'Every proposed minor has already been asked.' };

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

  const noGuardian = needsNewRequest.filter((id) => !guardianByPlayer.has(id));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('approval_requests').insert(rows);
    if (insertError) return { error: friendlyError(insertError) };

    await supabase.rpc('write_audit', {
      p_org_id: orgId,
      p_action: 'tournament.acknowledgement.requested',
      p_scope_type: 'tournament',
      p_entity_type: 'tournament_entry',
      p_entity_id: entryId,
      p_after: { player_ids: rows.map((r) => r.player_id) },
    });

    const label = await tournamentLabelFor(supabase, entryId);
    await Promise.all(
      rows.map((r) =>
        notifyAboutPlayer({
          playerId: r.player_id,
          template: 'tournament_roster.acknowledgement_requested',
          payload: { title: 'Tournament roster confirmation needed', body: `${label} needs your confirmation` },
        })
      )
    );
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  const parts: string[] = [];
  if (rows.length > 0) parts.push(`${rows.length} guardian${rows.length === 1 ? '' : 's'} asked`);
  if (noGuardian.length > 0) parts.push(`${noGuardian.length} can't be asked — no guardian on file`);
  return { success: true, message: parts.join('. ') + '.' };
}

/**
 * Stage 3 -- finalize. Ports every proposed player that is portable:
 * adults, and minors whose guardian has approved. port_squad_to_tournament
 * is the only place data crosses the org fence and it re-checks consent
 * itself, so a minor who hasn't been approved comes back 'consent_missing'
 * rather than slipping through.
 */
export async function finalizeRoster(entryId: string, orgId: string) {
  const supabase = await createClient();

  const { data: candidateRows } = await supabase
    .from('tournament_roster_candidates')
    .select('player_id')
    .eq('entry_id', entryId);
  const playerIds = (candidateRows ?? []).map((c) => c.player_id);
  if (playerIds.length === 0) return { error: 'Propose some players first.' };

  const { data: portResults, error: portError } = await supabase.rpc('port_squad_to_tournament', {
    p_entry_id: entryId,
    p_player_ids: playerIds,
  });
  if (portError) return { error: friendlyError(portError) };

  const portedIds = (portResults ?? []).filter((r: any) => r.outcome === 'ported').map((r: any) => r.player_id);
  const alreadyOn = (portResults ?? []).filter((r: any) => r.outcome === 'already_rostered').length;
  const label = await tournamentLabelFor(supabase, entryId);
  await Promise.all(
    portedIds.map((playerId: string) =>
      notifyAboutPlayer({
        playerId,
        template: 'tournament_roster.ported',
        payload: { title: 'Added to tournament roster', body: label },
      })
    )
  );

  const pending = (portResults ?? []).filter((r: any) => r.outcome === 'consent_missing').length;
  const notYours = (portResults ?? []).filter((r: any) => r.outcome === 'not_your_player').length;

  const parts: string[] = [];
  if (portedIds.length > 0) parts.push(`${portedIds.length} player${portedIds.length === 1 ? '' : 's'} added to the roster`);
  if (alreadyOn > 0) parts.push(`${alreadyOn} already on it`);
  if (pending > 0) parts.push(`${pending} still waiting on a guardian`);
  if (notYours > 0) parts.push(`${notYours} could not be ported`);
  if (parts.length === 0) parts.push('Nothing changed.');

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true, message: parts.join('. ') + '.' };
}

/**
 * Roster versioning (phase6w). Until it existed, a finalized roster was
 * immutable -- a late injury or withdrawal had no supported fix short of
 * editing the database by hand.
 *
 * The row is kept, marked `withdrawn` and stamped with the revision it left
 * in, so the roster as submitted at any earlier revision is still
 * reconstructible. The RPC is the only write path: tournament_roster's write
 * policy belongs to the *host* org, so club staff cannot touch their own
 * ported rows directly, and the RPC re-checks finalize_tournament_roster on
 * the entry's club/team -- the same gate the port itself uses, since taking a
 * player off is the same authority as putting one on.
 */
export async function withdrawFromRoster(rosterId: string, reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) return { error: 'Say why this player is being withdrawn.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('withdraw_from_tournament_roster', {
    p_roster_id: rosterId,
    p_reason: trimmed,
  });
  if (error) return { error: friendlyError(error) };

  const result = (data ?? [])[0] as
    | { withdrawn_player_id: string | null; withdrawn_name: string; new_revision: number }
    | undefined;

  // player_id is nullable on tournament_roster (ON DELETE SET NULL), so a row
  // whose player has since been deleted has nobody to notify.
  if (result?.withdrawn_player_id) {
    await notifyAboutPlayer({
      playerId: result.withdrawn_player_id,
      template: 'tournament_roster.withdrawn',
      payload: { title: 'Removed from tournament roster', body: trimmed },
    });
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return {
    success: true,
    message: `${result?.withdrawn_name ?? 'Player'} withdrawn — roster is now revision ${result?.new_revision ?? '?'}.`,
  };
}

/**
 * The export itself happens client-side (a Blob download, RosterBuilder.tsx)
 * -- there's no server round-trip to hang an audit call on otherwise, so
 * this one-line action exists purely to record that it happened, per the
 * Coach Module spec §20's "export generation" audit item.
 */
export async function recordRosterExport(
  entryId: string,
  orgId: string,
  format: 'txt' | 'pdf',
  playerCount: number,
  revision: number
) {
  const supabase = await createClient();
  await supabase.rpc('write_audit', {
    p_org_id: orgId,
    p_action: 'tournament.roster.exported',
    p_scope_type: 'tournament',
    p_entity_type: 'tournament_entry',
    p_entity_id: entryId,
    // Which revision left the building is the point of logging the export at
    // all now that a roster can change after it is finalized (phase6w).
    p_after: { format, player_count: playerCount, revision },
  });
  return { success: true };
}

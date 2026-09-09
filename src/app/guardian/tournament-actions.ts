'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notifyStaff } from '@/lib/notify';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Parent/Guardian spec §10-11: confirm or decline the player's tournament
 * participation. approval_requests' own check constraint requires a
 * decline_reason whenever status='declined' -- enforced here, not just at
 * the database, so the error reads as a form validation message rather
 * than a raw constraint violation.
 */
export async function decideAcknowledgement(approvalRequestId: string, decision: 'approved' | 'declined', declineReason?: string) {
  if (decision === 'declined' && !declineReason?.trim()) {
    return { error: 'Let the coach know why you’re declining.' };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('approval_requests')
    .update({
      status: decision,
      method: 'app',
      decided_at: new Date().toISOString(),
      decline_reason: decision === 'declined' ? declineReason!.trim() : null,
    })
    .eq('id', approvalRequestId)
    .select('org_id, subject_id, player_id')
    .single();

  if (error) return { error: friendlyError(error) };

  await supabase.rpc('write_audit', {
    p_org_id: updated.org_id,
    p_action: 'tournament.acknowledgement.decided',
    p_scope_type: 'tournament',
    p_entity_type: 'approval_request',
    p_entity_id: approvalRequestId,
    p_after: { decision, player_id: updated.player_id, entry_id: updated.subject_id, decline_reason: declineReason ?? null },
  });

  // P1-8 (gap analysis §5): a decline is the one outcome here a coach or
  // team manager actually needs to know about right away -- an approval
  // sits fine until they next open the roster; a decline means whoever
  // they were counting on can't play, and previously they'd only find out
  // by happening to check. Club-less entries (entrant_org_id with no
  // club_id) have no club staff to notify at all -- skipped, not an error.
  if (decision === 'declined') {
    const { data: entry } = await supabase
      .from('tournament_entries')
      .select('club_id, team_id, clubs(slug), teams(slug)')
      .eq('id', updated.subject_id)
      .maybeSingle();
    if (entry?.club_id && entry?.team_id && updated.player_id) {
      const { data: player } = await supabase.from('players').select('name').eq('id', updated.player_id).maybeSingle();
      const clubSlug = (entry as any).clubs?.slug;
      const teamSlug = (entry as any).teams?.slug;
      await notifyStaff({
        clubId: entry.club_id,
        orgId: updated.org_id,
        permissionKey: 'finalize_tournament_roster',
        teamId: entry.team_id,
        template: 'tournament_roster.acknowledgement_declined',
        payload: {
          title: 'Guardian declined tournament roster',
          body: `${player?.name ?? 'A player'}'s guardian declined — ${declineReason?.trim() ?? ''}`,
        },
        linkPath: clubSlug && teamSlug ? `/c/${clubSlug}/teams/${teamSlug}/tournaments/${updated.subject_id}` : undefined,
      });
    }
  }

  revalidatePath('/guardian', 'layout');
  return { success: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notifyAboutPlayer } from '@/lib/notify';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Moves a player to another of the SAME club's teams, preserving history --
 * transfer_player_to_team() (phase6i migration) closes the old team_memberships
 * stint, opens a new one, and updates players.team_id atomically, authorized
 * once against the shared club's manage_membership permission. No guardian
 * approval step (unlike the tournament-roster consent flow) -- the family is
 * notified, not asked.
 */
export async function transferPlayerToTeam(playerId: string, newTeamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('transfer_player_to_team', {
    p_player_id: playerId,
    p_new_team_id: newTeamId,
  });
  if (error) return { error: friendlyError(error) };

  const { data: team } = await supabase.from('teams').select('name, slug').eq('id', newTeamId).maybeSingle();
  await notifyAboutPlayer({
    playerId,
    template: 'movement.team_transferred',
    payload: { title: 'Moved to a new team', body: team?.name ? `Now on ${team.name}` : 'Team assignment updated' },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  // The page this action is called from is team-scoped (/teams/[teamSlug]/
  // players/[playerId]) and 404s once the player's team_id no longer
  // matches -- hand the new team's slug back so the caller can navigate
  // there instead of leaving the user on a route that just went stale.
  return { success: true, newTeamSlug: team?.slug ?? null };
}

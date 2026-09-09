import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import RosterBuilder from './RosterBuilder';

export default async function TournamentEntryPage({
  params,
}: {
  params: Promise<{ clubSlug: string; teamSlug: string; entryId: string }>;
}) {
  const { clubSlug, teamSlug, entryId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, slug, name').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();

  const { data: team } = await supabase.from('teams').select('id, slug, name, club_id').eq('slug', teamSlug).eq('club_id', club.id).maybeSingle();
  if (!team) notFound();

  const { data: entry, error: entryError } = await supabase
    .from('tournament_entries')
    .select('id, status, team_id, entrant_org_id, tournament_id, category_id, tournaments(name, venue, event_date), tournament_categories(name, age_group, format)')
    .eq('id', entryId)
    .maybeSingle();

  if (entryError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this entry: {entryError.message}</p>
        </div>
      </main>
    );
  }
  if (!entry || entry.team_id !== team.id) notFound();
  if (!entry.entrant_org_id) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">This entry has no entrant org set — ask a platform admin to fix its setup.</p>
        </div>
      </main>
    );
  }

  const tournament = (entry as any).tournaments;
  const category = (entry as any).tournament_categories;

  const [
    { data: canFillRes },
    { data: canRequestRes },
    { data: canFinalizeRes },
    { data: rosterPlayers },
    { data: finalRoster },
    { data: approvalRows },
    { data: candidateRowsRaw },
  ] = await Promise.all([
    supabase.rpc('has_staff_permission', { p_permission_key: 'fill_tournament_roster', p_club_id: club.id, p_team_id: team.id }),
    supabase.rpc('has_staff_permission', { p_permission_key: 'request_guardian_acknowledgement', p_club_id: club.id, p_team_id: team.id }),
    supabase.rpc('has_staff_permission', { p_permission_key: 'finalize_tournament_roster', p_club_id: club.id, p_team_id: team.id }),
    supabase.from('players').select('id, name, jersey, position, dob').eq('team_id', team.id).order('name'),
    supabase.from('tournament_roster').select('id, full_name, jersey, position, player_id').eq('entry_id', entryId).order('full_name'),
    supabase
      .from('approval_requests')
      .select('id, player_id, status, decline_reason, requested_at, decided_at')
      .eq('subject_type', 'tournament_roster')
      .eq('subject_id', entryId),
    supabase.from('tournament_roster_candidates').select('player_id').eq('entry_id', entryId),
  ]);

  const finalizedPlayerIds = new Set((finalRoster ?? []).map((r) => r.player_id).filter(Boolean));
  const candidateIds = new Set((candidateRowsRaw ?? []).map((c) => c.player_id));
  const approvalByPlayer = new Map((approvalRows ?? []).map((a) => [a.player_id, a]));

  const allPlayers = rosterPlayers ?? [];

  // requires_guardian_consent is single-player -- resolved per player, not
  // attempted as a bulk call. Guardian presence decides whether a proposed
  // minor is merely unasked or genuinely un-askable.
  const [needsConsent, guardianLinks] = await Promise.all([
    Promise.all(allPlayers.map((p) => supabase.rpc('requires_guardian_consent', { p_player_id: p.id }).then((r) => !!r.data))),
    allPlayers.length
      ? supabase.from('player_guardians').select('player_id').in('player_id', allPlayers.map((p) => p.id))
      : Promise.resolve({ data: [] as { player_id: string }[] }),
  ]);
  const hasGuardian = new Set(((guardianLinks as any).data ?? []).map((g: any) => g.player_id));

  const playerRows = allPlayers.map((p, i) => {
    const approval = approvalByPlayer.get(p.id);
    return {
      id: p.id,
      name: p.name,
      jersey: p.jersey,
      position: p.position,
      needsConsent: needsConsent[i],
      hasGuardian: hasGuardian.has(p.id),
      isCandidate: candidateIds.has(p.id),
      isFinalized: finalizedPlayerIds.has(p.id),
      approvalStatus: approval?.status ?? null,
      declineReason: approval?.decline_reason ?? null,
    };
  });

  const finalizedRows = (finalRoster ?? []).map((r) => ({ id: r.id, name: r.full_name, jersey: r.jersey, position: r.position }));

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}/teams/${teamSlug}`} className="back-link">← {team.name}</Link>

        <div className="page-header">
          <div>
            <h1>{tournament?.name ?? 'Tournament'}{category?.name ? ` — ${category.name}` : ''}</h1>
            <p className="subtitle">
              {tournament?.venue ?? 'Venue TBD'}
              {tournament?.event_date ? ` · ${new Date(tournament.event_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
            </p>
          </div>
          <span className="chip">{entry.status}</span>
        </div>

        {entry.status !== 'accepted' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              This entry is <strong>{entry.status}</strong> — a roster can only be submitted once it&apos;s accepted.
            </p>
          </div>
        )}

        <RosterBuilder
          entryId={entryId}
          orgId={entry.entrant_org_id}
          teamName={team.name}
          tournamentName={tournament?.name ?? 'Tournament'}
          categoryName={category?.name ?? null}
          entryAccepted={entry.status === 'accepted'}
          canFill={!!canFillRes}
          canRequest={!!canRequestRes}
          canFinalize={!!canFinalizeRes}
          players={playerRows}
          finalizedRoster={finalizedRows}
        />
      </div>
    </main>
  );
}

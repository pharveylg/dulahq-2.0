import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import ProfileForm from './ProfileForm';
import Evaluations from './Evaluations';
import Goals from './Goals';
import Notes from './Notes';
import Timeline from './Timeline';
import SlotTabs from '@/components/motion/SlotTabs';

export default async function PlayerDevelopmentPage({
  params,
}: {
  params: Promise<{ clubSlug: string; teamSlug: string; playerId: string }>;
}) {
  const { clubSlug, teamSlug, playerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, slug, name').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();
  const clubId = club.id;

  const { data: team } = await supabase.from('teams').select('id, slug, name, club_id').eq('slug', teamSlug).eq('club_id', clubId).maybeSingle();
  if (!team) notFound();
  const teamId = team.id;

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, name, jersey, position, secondary_position, preferred_foot, dob, age, development_status, team_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this player: {playerError.message}</p>
        </div>
      </main>
    );
  }
  if (!player || player.team_id !== teamId) notFound();

  const access = await getClubAccess(clubId);
  const assignedTeamIds = access.isClubAdmin ? [] : await getAssignedTeamIds();
  const canManage = access.isClubAdmin || assignedTeamIds.includes(teamId);

  const { data: skillRows } = await supabase.from('development_skills').select('id, category, name, sort_order').order('category').order('sort_order');
  const skills = skillRows ?? [];

  const { data: evaluations } = await supabase
    .from('player_evaluations')
    .select('id, evaluation_date, period, technical_score, tactical_score, physical_score, mental_score, strengths, development_areas, coach_comments, visibility, created_at')
    .eq('player_id', playerId)
    .order('evaluation_date', { ascending: false });

  const evaluationIds = (evaluations ?? []).map((e) => e.id);
  const { data: ratingRows } = evaluationIds.length
    ? await supabase
        .from('player_skill_ratings')
        .select('evaluation_id, rating, development_skills(id, name, category)')
        .in('evaluation_id', evaluationIds)
    : { data: [] };

  const ratingsByEvaluation = new Map<string, any[]>();
  for (const r of ratingRows ?? []) {
    const list = ratingsByEvaluation.get(r.evaluation_id) ?? [];
    list.push({ rating: r.rating, skill: (r as any).development_skills });
    ratingsByEvaluation.set(r.evaluation_id, list);
  }

  const { data: goals } = await supabase
    .from('development_goals')
    .select('id, title, description, starting_level, target_level, current_level, start_date, target_date, status, success_criteria, visibility, created_at, development_skills(name)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  const { data: notes } = await supabase
    .from('player_development_notes')
    .select('id, note, visibility, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('status, training_sessions!inner(team_id)')
    .eq('player_id', playerId)
    .eq('training_sessions.team_id', teamId);

  const eligible = (attendanceRows ?? []).filter((a) => !['injured', 'suspended'].includes(a.status));
  const attended = eligible.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePct = eligible.length ? Math.round((attended / eligible.length) * 100) : null;

  return (
    <main className="page">
      <div className="container">
        <Link href={`/clubs/${clubSlug}/teams/${teamSlug}`} className="back-link">← {team.name}</Link>

        <div className="page-header">
          <div>
            <h1>{player.name}</h1>
            <p className="subtitle">
              {[player.jersey && `#${player.jersey}`, player.position, player.secondary_position && `/ ${player.secondary_position}`, player.age && `${player.age}y`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {attendancePct !== null && <span className="chip">Attendance {attendancePct}%</span>}
            <span className="chip">{(evaluations ?? []).length} evaluations</span>
            <span className="chip">{(goals ?? []).filter((g) => !['achieved', 'archived'].includes(g.status)).length} active goals</span>
          </div>
        </div>

        <ProfileForm player={player as any} canManage={canManage} />

        <div style={{ marginTop: 24 }}>
          <SlotTabs
            layoutId="player-dev-tabs"
            tabs={[
              { id: 'goals', label: 'Goals', badge: (goals ?? []).filter((g) => !['achieved', 'archived'].includes(g.status)).length },
              { id: 'evaluations', label: 'Evaluations', badge: (evaluations ?? []).length },
              { id: 'notes', label: 'Notes', badge: (notes ?? []).length },
              { id: 'timeline', label: 'Timeline' },
            ]}
            slots={{
              goals: (
                <Goals playerId={playerId} teamId={teamId} clubId={clubId} goals={(goals ?? []) as any} skills={skills} canManage={canManage} />
              ),
              evaluations: (
                <Evaluations
                  playerId={playerId}
                  teamId={teamId}
                  clubId={clubId}
                  evaluations={(evaluations ?? []).map((e) => ({ ...e, ratings: ratingsByEvaluation.get(e.id) ?? [] }))}
                  skills={skills}
                  canManage={canManage}
                />
              ),
              notes: (
                <Notes playerId={playerId} teamId={teamId} clubId={clubId} notes={notes ?? []} canManage={canManage} />
              ),
              timeline: (
                <Timeline evaluations={evaluations ?? []} goals={goals ?? []} notes={notes ?? []} />
              ),
            }}
          />
        </div>
      </div>
    </main>
  );
}

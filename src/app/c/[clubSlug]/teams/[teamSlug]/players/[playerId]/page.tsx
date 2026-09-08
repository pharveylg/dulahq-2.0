import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PlayerProfile from '@/components/player-profile/PlayerProfile';

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

  const { data: team } = await supabase.from('teams').select('id, slug, name, club_id').eq('slug', teamSlug).eq('club_id', club.id).maybeSingle();
  if (!team) notFound();

  const { data: player, error: playerError } = await supabase.from('players').select('id, name, team_id').eq('id', playerId).maybeSingle();
  if (playerError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this player: {playerError.message}</p>
        </div>
      </main>
    );
  }
  if (!player || player.team_id !== team.id) notFound();

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}/teams/${teamSlug}`} className="back-link">← {team.name}</Link>

        <div className="page-header">
          <div>
            <h1>{player.name}</h1>
          </div>
        </div>

        <PlayerProfile playerId={playerId} viewer="coach" layoutId={`player-profile-${playerId}`} />
      </div>
    </main>
  );
}

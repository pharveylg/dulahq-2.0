import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import PlayerProfile from '@/components/player-profile/PlayerProfile';

export default async function PlayerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) redirect('/');

  const { data: player } = await supabase
    .from('players')
    .select('id, name, team_id, teams(club_id)')
    .eq('user_id', dulaUser.id)
    .maybeSingle();

  if (!player) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="page-header"><h1>No player account linked</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This page is for linked players. Ask your club (or your guardian) to link your account.
          </p>
        </div>
      </main>
    );
  }

  const teamId = player.team_id;
  const clubId = (player as any).teams?.club_id ?? null;

  // Announcements aren't part of the canonical Player Profile (Overview /
  // Development / Fees / Membership / Family) -- kept as a sibling tab here
  // rather than folded into the shared component, same as the guardian page.
  const { data: teamAnnouncements } = teamId
    ? await supabase
        .from('announcements')
        .select('id, title, body, pinned, created_at')
        .eq('audience', 'team')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const { data: clubAnnouncements } = clubId
    ? await supabase
        .from('announcements')
        .select('id, title, body, pinned, created_at')
        .in('audience', ['club', 'players'])
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const announcements = [...(teamAnnouncements ?? []), ...(clubAnnouncements ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>{player.name}</h1>
          </div>
        </div>

        <PlayerProfile
          playerId={player.id}
          viewer="player"
          layoutId="player-home-profile"
          extraTabs={[
            {
              id: 'announcements',
              label: 'Announcements',
              badge: announcements.length,
              content: (
                <div className="card">
                  {announcements.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing posted yet.</p>}
                  {announcements.map((a) => (
                    <div key={a.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                      <div className="list-row-title">{a.pinned && '📌 '}{a.title}</div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{a.body}</p>
                      <div className="list-row-meta">{new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}

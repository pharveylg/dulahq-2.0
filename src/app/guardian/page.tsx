import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import SlotTabs from '@/components/motion/SlotTabs';
import PlayerProfile from '@/components/player-profile/PlayerProfile';

export default async function GuardianHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) redirect('/');

  const { data: guardian } = await supabase
    .from('guardians')
    .select('id, name')
    .eq('user_id', dulaUser.id)
    .eq('account_status', 'active')
    .maybeSingle();

  if (!guardian) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="page-header"><h1>No guardian account</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This page is for linked guardians. Ask your club to invite you first.
          </p>
        </div>
      </main>
    );
  }

  const { data: links } = await supabase
    .from('player_guardians')
    .select('player_id, relationship, players(id, name, team_id, teams(id, name, club_id, clubs(name)))')
    .eq('guardian_id', guardian.id);

  const children = (links ?? []).map((l: any) => l.players).filter(Boolean);
  const teamIds = [...new Set(children.map((c: any) => c.team_id).filter(Boolean))];
  const clubIds = [...new Set(children.map((c: any) => c.teams?.club_id).filter(Boolean))];

  // Announcements aren't part of the canonical Player Profile -- one shared
  // tab across all children, same as before, rather than duplicated per child.
  const { data: teamAnnouncements } = teamIds.length
    ? await supabase
        .from('announcements')
        .select('id, title, body, audience, team_id, pinned, created_at, clubs(name)')
        .eq('audience', 'team')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const { data: clubAnnouncements } = clubIds.length
    ? await supabase
        .from('announcements')
        .select('id, title, body, audience, team_id, pinned, created_at, clubs(name)')
        .in('audience', ['club', 'guardians'])
        .in('club_id', clubIds)
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
            <h1>Hi, {guardian.name}</h1>
            <p className="subtitle">{children.length} child{children.length === 1 ? '' : 'ren'}</p>
          </div>
        </div>

        {children.length === 0 && (
          <div className="card empty-state">
            <p>No children linked to your account yet — ask your club to link you to your player.</p>
          </div>
        )}

        {children.length > 0 && (
          <SlotTabs
            layoutId="guardian-home-tabs"
            tabs={[
              ...children.map((c: any) => ({ id: c.id, label: c.name })),
              { id: 'announcements', label: 'Announcements', badge: announcements.length },
            ]}
            slots={{
              ...Object.fromEntries(
                children.map((child: any) => [
                  child.id,
                  <PlayerProfile key={child.id} playerId={child.id} viewer="guardian" layoutId={`guardian-profile-${child.id}`} />,
                ])
              ),
              announcements: (
                <div className="card">
                  {announcements.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing posted yet.</p>}
                  {announcements.map((a: any) => (
                    <div key={a.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                      <div className="list-row-title">{a.pinned && '📌 '}{a.title}</div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{a.body}</p>
                      <div className="list-row-meta">{a.clubs?.name} · {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                  ))}
                </div>
              ),
            }}
          />
        )}
      </div>
    </main>
  );
}

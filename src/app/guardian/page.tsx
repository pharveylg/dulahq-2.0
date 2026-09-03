import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import SlotTabs from '@/components/motion/SlotTabs';

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
    .select('player_id, relationship, players(id, name, jersey, position, team_id, teams(id, name, club_id, clubs(name)))')
    .eq('guardian_id', guardian.id);

  const children = (links ?? [])
    .map((l: any) => l.players)
    .filter(Boolean);

  const playerIds = children.map((c: any) => c.id);
  const teamIds = [...new Set(children.map((c: any) => c.team_id).filter(Boolean))];
  const clubIds = [...new Set(children.map((c: any) => c.teams?.club_id).filter(Boolean))];

  const { data: upcomingSessions } = teamIds.length
    ? await supabase
        .from('training_sessions')
        .select('id, team_id, starts_at, ends_at, status')
        .in('team_id', teamIds)
        .eq('status', 'scheduled')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(10)
    : { data: [] };

  const { data: fees } = playerIds.length
    ? await supabase
        .from('fee_charges')
        .select('id, player_id, fee_type, amount, currency, status, due_date')
        .in('player_id', playerIds)
        .neq('status', 'paid')
        .order('due_date')
    : { data: [] };

  // Team-scoped only -- announcements' RLS only grants a guardian
  // visibility via their child's team (audience='team'), not club-wide
  // ones (audience='club' requires is_club_staff, which a guardian isn't).
  // Matches what's actually visible rather than requesting rows RLS
  // would just silently filter back out.
  const { data: goals } = playerIds.length
    ? await supabase
        .from('development_goals')
        .select('id, player_id, title, starting_level, target_level, current_level, status, development_skills(name)')
        .in('player_id', playerIds)
        .not('status', 'in', '(archived)')
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: feedback } = playerIds.length
    ? await supabase
        .from('player_development_notes')
        .select('id, player_id, note, created_at')
        .in('player_id', playerIds)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] };

  const { data: teamAnnouncements } = teamIds.length
    ? await supabase
        .from('announcements')
        .select('id, title, body, audience, team_id, pinned, created_at, clubs(name)')
        .eq('audience', 'team')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  // Club-wide and 'guardians'-audience announcements are also RLS-visible
  // to a guardian now (fix_announcements_visibility_gap) -- merge them in
  // alongside the team-scoped ones rather than only showing the latter.
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

  const sessionsByTeam = new Map<string, any[]>();
  for (const s of upcomingSessions ?? []) {
    const list = sessionsByTeam.get(s.team_id) ?? [];
    list.push(s);
    sessionsByTeam.set(s.team_id, list);
  }
  const feesByPlayer = new Map<string, any[]>();
  for (const f of fees ?? []) {
    const list = feesByPlayer.get(f.player_id) ?? [];
    list.push(f);
    feesByPlayer.set(f.player_id, list);
  }
  const goalsByPlayer = new Map<string, any[]>();
  for (const g of goals ?? []) {
    const list = goalsByPlayer.get(g.player_id) ?? [];
    list.push(g);
    goalsByPlayer.set(g.player_id, list);
  }
  const feedbackByPlayer = new Map<string, any[]>();
  for (const f of feedback ?? []) {
    const list = feedbackByPlayer.get(f.player_id) ?? [];
    list.push(f);
    feedbackByPlayer.set(f.player_id, list);
  }

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
                children.map((child: any) => {
                  const sessions = sessionsByTeam.get(child.team_id) ?? [];
                  const outstandingFees = feesByPlayer.get(child.id) ?? [];
                  const childGoals = goalsByPlayer.get(child.id) ?? [];
                  const childFeedback = feedbackByPlayer.get(child.id) ?? [];
                  return [
                    child.id,
                    <div key={child.id} className="card">
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                        {child.teams?.name ?? 'No team'} · {child.teams?.clubs?.name ?? ''}
                        {child.jersey ? ` · #${child.jersey}` : ''}
                      </p>

                      <div className="section-label" style={{ fontSize: 11 }}>Upcoming training</div>
                      {sessions.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>Nothing scheduled.</p>}
                      {sessions.map((s) => (
                        <div key={s.id} className="list-row" style={{ padding: '6px 0' }}>
                          <span style={{ fontSize: 13 }}>
                            {new Date(s.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {new Date(s.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}

                      {outstandingFees.length > 0 && (
                        <>
                          <div className="section-label" style={{ fontSize: 11, marginTop: 12 }}>Outstanding fees</div>
                          {outstandingFees.map((f) => (
                            <div key={f.id} className="list-row" style={{ padding: '6px 0' }}>
                              <span style={{ fontSize: 13 }}>{f.fee_type} — {f.currency} {Number(f.amount).toFixed(2)}</span>
                              <span className="chip" style={{ color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' }}>{f.status}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {childGoals.length > 0 && (
                        <>
                          <div className="section-label" style={{ fontSize: 11, marginTop: 12 }}>Development</div>
                          {childGoals.map((g: any) => {
                            const progress = g.starting_level && g.target_level && g.target_level !== g.starting_level && g.current_level != null
                              ? Math.max(0, Math.min(100, Math.round(((g.current_level - g.starting_level) / (g.target_level - g.starting_level)) * 100)))
                              : null;
                            return (
                              <div key={g.id} style={{ padding: '6px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                  <span>{g.title}{g.development_skills?.name ? ` — ${g.development_skills.name}` : ''}</span>
                                  <span className="chip" style={{ fontSize: 10 }}>{g.status.replace('_', ' ')}</span>
                                </div>
                                {progress !== null && (
                                  <div className="progress-track" style={{ height: 5, marginTop: 4 }}><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}

                      {childFeedback.length > 0 && (
                        <>
                          <div className="section-label" style={{ fontSize: 11, marginTop: 12 }}>Coach feedback</div>
                          {childFeedback.map((f: any) => (
                            <div key={f.id} style={{ padding: '4px 0' }}>
                              <p style={{ fontSize: 13, margin: 0 }}>&ldquo;{f.note}&rdquo;</p>
                              <div className="list-row-meta">{new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>,
                  ];
                })
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

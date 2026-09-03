import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import EditNameForm from './EditNameForm';
import AddStaffForm from './AddStaffForm';
import LinkTeamForm from './LinkTeamForm';
import StaffRow from './StaffRow';
import Trips from './Trips';
import Announcements from './Announcements';
import MediaGallery from './MediaGallery';
import { getDownloadUrl } from '../../../../shared/files/lib/r2';

export default async function ClubDetailPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id, slug, name, created_at')
    .eq('slug', clubSlug)
    .maybeSingle();

  if (clubError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this club: {clubError.message}</p>
        </div>
      </main>
    );
  }
  if (!club) notFound();

  // Everything below this line uses club.id (the real UUID) for every
  // query/action/RLS check exactly as before slugs existed -- only the
  // route param and the hrefs built for navigation use the slug.
  const clubId = club.id;

  // access.isClubAdmin gates club-wide actions (rename, staff, link teams,
  // any-audience announcements); access.isStaff gates the broader "any
  // club_staff role" actions RLS still allows unscoped (trips, media).
  const access = await getClubAccess(clubId);
  const canManage = access.isClubAdmin;
  const canManageWide = access.isStaff;
  const myAssignedTeamIds = access.isClubAdmin ? [] : await getAssignedTeamIds();

  const { data: staffRows } = await supabase
    .from('club_staff')
    .select('id, role, user_id, users(name, email)')
    .eq('club_id', clubId)
    .order('role');

  const { data: clubTeams } = await supabase
    .from('teams')
    .select('id, slug, name')
    .eq('club_id', clubId)
    .order('name');

  const { data: unclaimedTeams } = canManage
    ? await supabase.from('teams').select('id, name').is('club_id', null).order('name')
    : { data: [] };

  // Assigned-team lookups, per staff member with a coach/team_manager role.
  const relevantStaffUserIds = (staffRows ?? [])
    .filter((s) => s.role === 'coach' || s.role === 'team_manager')
    .map((s) => s.user_id);

  const { data: assignments } = relevantStaffUserIds.length
    ? await supabase
        .from('user_assigned_teams')
        .select('user_id, team_id')
        .in('user_id', relevantStaffUserIds)
    : { data: [] };

  const assignedTeamIdsByUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedTeamIdsByUser.get(a.user_id) ?? [];
    list.push(a.team_id);
    assignedTeamIdsByUser.set(a.user_id, list);
  }

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, purpose, starts_at, ends_at')
    .eq('club_id', clubId)
    .order('starts_at', { ascending: false });

  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('id, title, body, audience, team_id, pinned, created_at, teams(name)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  const announcements = (announcementRows ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    teamId: a.team_id,
    teamName: a.teams?.name ?? null,
    pinned: a.pinned,
    createdAt: a.created_at,
  }));

  const { data: mediaRows } = await supabase
    .from('media')
    .select('id, r2_key, file_name, caption')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  // Signed URLs are generated server-side per request rather than stored
  // -- R2 objects aren't public, and a signed URL expires in an hour
  // (see shared/files/lib/r2.ts), so caching one wouldn't stay valid.
  const mediaItems = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({
      id: m.id,
      url: await getDownloadUrl(m.r2_key),
      fileName: m.file_name,
      caption: m.caption,
    }))
  );

  return (
    <main className="page">
      <div className="container">
        <Link href="/clubs" className="back-link">← Clubs</Link>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1>{club.name}</h1>
            {canManage && <EditNameForm clubId={club.id} initialName={club.name} />}
          </div>
          <span className="chip">
            {access.isPlatformAdmin ? 'Platform admin' : access.role ? access.role.replace('_', ' ') : 'No access here'}
          </span>
        </div>

        <div className="section-label">
          {access.isClubAdmin ? `Teams (${clubTeams?.length ?? 0})` : `My teams (${myAssignedTeamIds.length} of ${clubTeams?.length ?? 0})`}
        </div>
        <div className="card">
          {(!clubTeams || clubTeams.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams linked yet.</p>
          )}
          {[...(clubTeams ?? [])]
            .sort((a, b) => {
              if (access.isClubAdmin) return 0;
              return Number(myAssignedTeamIds.includes(b.id)) - Number(myAssignedTeamIds.includes(a.id));
            })
            .map((t) => {
              const assigned = access.isClubAdmin || myAssignedTeamIds.includes(t.id);
              return (
                <Link key={t.id} href={`/clubs/${club.slug}/teams/${t.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="list-row-title">{t.name}</span>
                  <span className="chip" style={assigned ? undefined : { color: 'var(--text-muted)' }}>
                    {assigned ? 'Roster →' : 'Not assigned →'}
                  </span>
                </Link>
              );
            })}
          {canManage && <LinkTeamForm clubId={club.id} unclaimedTeams={unclaimedTeams ?? []} />}
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Staff ({staffRows?.length ?? 0})
        </div>
        <div className="card">
          {(!staffRows || staffRows.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No staff added yet.</p>
          )}
          {staffRows?.map((s: any) => (
            <StaffRow
              key={s.id}
              clubId={club.id}
              staff={s}
              clubTeams={clubTeams ?? []}
              assignedTeamIds={assignedTeamIdsByUser.get(s.user_id) ?? []}
            />
          ))}
        </div>

        {canManage ? (
          <AddStaffForm clubId={club.id} />
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            Only a club admin or a platform admin can manage club settings and staff.
          </p>
        )}

        <div className="section-label" style={{ marginTop: 28 }}>
          Trips ({trips?.length ?? 0})
        </div>
        <Trips clubId={club.id} clubSlug={club.slug} trips={trips ?? []} canManage={canManageWide} />

        <div className="section-label" style={{ marginTop: 28 }}>
          Announcements ({announcements.length})
        </div>
        <Announcements
          clubId={club.id}
          announcements={announcements}
          teams={clubTeams ?? []}
          canManage={canManageWide}
          isClubAdmin={access.isClubAdmin}
          assignedTeamIds={myAssignedTeamIds}
        />

        <div className="section-label" style={{ marginTop: 28 }}>
          Photos ({mediaItems.length})
        </div>
        <MediaGallery clubId={club.id} items={mediaItems} canManage={canManageWide} />
      </div>
    </main>
  );
}

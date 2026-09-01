import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess } from '@/lib/supabase/server';
import PassengerList from './PassengerList';
import TransportationList from './TransportationList';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ clubId: string; tripId: string }>;
}) {
  const { clubId, tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).maybeSingle();
  if (!club) notFound();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, name, purpose, starts_at, ends_at, club_id')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this trip: {tripError.message}</p>
        </div>
      </main>
    );
  }
  if (!trip || trip.club_id !== clubId) notFound();

  // Trips are deliberately NOT scoped to assigned teams (RBAC Phase 1
  // audit flagged this: trips are inherently multi-team by design, and the
  // RBAC doc's role tables never mention them) -- any club staff can manage
  // any trip, same as before.
  const access = await getClubAccess(clubId);
  const canManage = access.isStaff;

  // Every player on any team linked to this club is eligible to be a
  // passenger -- trips aren't team-scoped, they're club-wide.
  const { data: clubTeams } = await supabase.from('teams').select('id').eq('club_id', clubId);
  const teamIds = (clubTeams ?? []).map((t) => t.id);
  const { data: clubPlayers } = teamIds.length
    ? await supabase.from('players').select('id, name').in('team_id', teamIds).order('name')
    : { data: [] };

  const { data: passengerRows } = await supabase
    .from('trip_passengers')
    .select('id, seat, players(id, name)')
    .eq('trip_id', tripId);

  const passengers = (passengerRows ?? []).map((p: any) => ({
    id: p.id,
    playerId: p.players?.id,
    playerName: p.players?.name ?? 'Unknown',
    seat: p.seat,
  }));

  const { data: transportRows } = await supabase
    .from('trip_transportation')
    .select('id, vehicle_info, pickup_point, dropoff_point')
    .eq('trip_id', tripId);

  const transportation = (transportRows ?? []).map((t: any) => ({
    id: t.id,
    description: t.vehicle_info?.description ?? null,
    pickupPoint: t.pickup_point,
    dropoffPoint: t.dropoff_point,
  }));

  const dateRange = trip.starts_at
    ? new Date(trip.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      (trip.ends_at ? ` – ${new Date(trip.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : '')
    : null;

  return (
    <main className="page">
      <div className="container">
        <Link href={`/clubs/${clubId}`} className="back-link">← {club.name}</Link>

        <div className="page-header">
          <div>
            <h1>{trip.name}</h1>
            <p className="subtitle">
              <span className="chip">{trip.purpose}</span>
              {dateRange ? ` · ${dateRange}` : ''}
            </p>
          </div>
        </div>

        <PassengerList clubId={clubId} tripId={tripId} passengers={passengers} availablePlayers={clubPlayers ?? []} canManage={canManage} />
        <TransportationList clubId={clubId} tripId={tripId} transportation={transportation} canManage={canManage} />
      </div>
    </main>
  );
}

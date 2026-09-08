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

export async function addPassenger(clubId: string, tripId: string, formData: FormData) {
  const playerId = formData.get('playerId') as string;
  const seat = (formData.get('seat') as string)?.trim() || null;
  if (!playerId) return { error: 'Choose a player.' };

  const supabase = await createClient();
  const { error } = await supabase.from('trip_passengers').insert({ trip_id: tripId, player_id: playerId, seat });

  if (error) {
    if (error.code === '23505') return { error: 'That player is already on this trip.' };
    return { error: friendlyError(error) };
  }

  const { data: trip } = await supabase.from('trips').select('name').eq('id', tripId).maybeSingle();
  await notifyAboutPlayer({
    playerId,
    template: 'trip.passenger_added',
    payload: { title: 'Added to a trip', body: trip?.name ?? 'A club trip' },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function removePassenger(clubId: string, tripId: string, passengerId: string) {
  const supabase = await createClient();

  const { data: passenger } = await supabase.from('trip_passengers').select('player_id').eq('id', passengerId).maybeSingle();

  const { error } = await supabase.from('trip_passengers').delete().eq('id', passengerId);
  if (error) return { error: friendlyError(error) };

  if (passenger) {
    const { data: trip } = await supabase.from('trips').select('name').eq('id', tripId).maybeSingle();
    await notifyAboutPlayer({
      playerId: passenger.player_id,
      template: 'trip.passenger_removed',
      payload: { title: 'Removed from a trip', body: trip?.name ?? 'A club trip' },
    });
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function addTransportation(clubId: string, tripId: string, formData: FormData) {
  const description = (formData.get('description') as string)?.trim();
  const pickupPoint = (formData.get('pickupPoint') as string)?.trim() || null;
  const dropoffPoint = (formData.get('dropoffPoint') as string)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from('trip_transportation').insert({
    trip_id: tripId,
    vehicle_info: description ? { description } : {},
    pickup_point: pickupPoint,
    dropoff_point: dropoffPoint,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function removeTransportation(clubId: string, tripId: string, transportId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('trip_transportation').delete().eq('id', transportId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

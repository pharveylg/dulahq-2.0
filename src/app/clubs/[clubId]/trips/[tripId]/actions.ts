'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
  revalidatePath(`/clubs/${clubId}/trips/${tripId}`);
  return { success: true };
}

export async function removePassenger(clubId: string, tripId: string, passengerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('trip_passengers').delete().eq('id', passengerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}/trips/${tripId}`);
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
  revalidatePath(`/clubs/${clubId}/trips/${tripId}`);
  return { success: true };
}

export async function removeTransportation(clubId: string, tripId: string, transportId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('trip_transportation').delete().eq('id', transportId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}/trips/${tripId}`);
  return { success: true };
}

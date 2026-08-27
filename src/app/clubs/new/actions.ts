'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createClub(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();

  if (!name) {
    return { error: 'Club name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clubs')
    .insert({ name })
    .select()
    .single();

  if (error) {
    // RLS currently only allows the 'admin' role to create clubs -- a
    // permission error here almost always means the signed-in user
    // isn't an admin, not a bug. Surface that plainly rather than the
    // raw Postgres error.
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return { error: 'Only a platform admin can create a club.' };
    }
    return { error: error.message };
  }

  redirect(`/clubs/${data.id}`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function createDrill(clubId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const category = formData.get('category') as string;
  if (!name) return { error: 'Drill name is required.' };
  if (!category) return { error: 'Category is required.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const skillsRaw = (formData.get('skills') as string)?.trim();
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const toIntOrNull = (v: FormDataEntryValue | null) => {
    const n = parseInt((v as string) ?? '', 10);
    return isNaN(n) ? null : n;
  };

  const { error } = await supabase.from('drills').insert({
    club_id: clubId,
    name,
    description: (formData.get('description') as string)?.trim() || null,
    category,
    theme: (formData.get('theme') as string)?.trim() || null,
    age_min: toIntOrNull(formData.get('ageMin')),
    age_max: toIntOrNull(formData.get('ageMax')),
    player_min: toIntOrNull(formData.get('playerMin')),
    player_max: toIntOrNull(formData.get('playerMax')),
    duration_minutes: toIntOrNull(formData.get('durationMinutes')),
    difficulty: (formData.get('difficulty') as string) || null,
    equipment: (formData.get('equipment') as string)?.trim() || null,
    objective: (formData.get('objective') as string)?.trim() || null,
    coaching_points: (formData.get('coachingPoints') as string)?.trim() || null,
    skills,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteDrill(drillId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('drills').delete().eq('id', drillId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

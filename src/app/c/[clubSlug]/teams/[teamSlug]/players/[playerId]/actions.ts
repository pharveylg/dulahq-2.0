'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function updateProfile(playerId: string, formData: FormData) {
  const supabase = await createClient();
  const dob = (formData.get('dob') as string) || null;
  const { error } = await supabase
    .from('players')
    .update({
      secondary_position: (formData.get('secondaryPosition') as string)?.trim() || null,
      preferred_foot: (formData.get('preferredFoot') as string) || null,
      dob,
      development_status: (formData.get('developmentStatus') as string) || 'on_track',
    })
    .eq('id', playerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function addEvaluation(playerId: string, teamId: string, clubId: string, formData: FormData) {
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const toScore = (v: FormDataEntryValue | null) => {
    const n = parseFloat((v as string) ?? '');
    return isNaN(n) ? null : n;
  };

  const { data: evaluation, error } = await supabase
    .from('player_evaluations')
    .insert({
      player_id: playerId,
      team_id: teamId,
      club_id: clubId,
      coach_id: dulaUser?.id,
      evaluation_date: (formData.get('evaluationDate') as string) || new Date().toISOString().slice(0, 10),
      period: (formData.get('period') as string)?.trim() || null,
      technical_score: toScore(formData.get('technicalScore')),
      tactical_score: toScore(formData.get('tacticalScore')),
      physical_score: toScore(formData.get('physicalScore')),
      mental_score: toScore(formData.get('mentalScore')),
      strengths: (formData.get('strengths') as string)?.trim() || null,
      development_areas: (formData.get('developmentAreas') as string)?.trim() || null,
      coach_comments: (formData.get('coachComments') as string)?.trim() || null,
      visibility: (formData.get('visibility') as string) || 'coach_only',
      created_by: dulaUser?.id,
    })
    .select('id')
    .single();

  if (error) return { error: friendlyError(error) };

  // Per-skill ratings: form fields are named "rating_<skillId>", only
  // submitted ones (non-empty) become rows -- a coach isn't forced to
  // rate every skill in the framework every time.
  const ratingRows: { evaluation_id: string; skill_id: string; rating: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('rating_') || !value) continue;
    const rating = parseInt(value as string, 10);
    if (isNaN(rating)) continue;
    ratingRows.push({ evaluation_id: evaluation.id, skill_id: key.replace('rating_', ''), rating });
  }
  if (ratingRows.length) {
    const { error: ratingsError } = await supabase.from('player_skill_ratings').insert(ratingRows);
    if (ratingsError) return { error: friendlyError(ratingsError) };
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function addGoal(playerId: string, teamId: string, clubId: string, formData: FormData) {
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const toLevel = (v: FormDataEntryValue | null) => {
    const n = parseInt((v as string) ?? '', 10);
    return isNaN(n) ? null : n;
  };

  const title = (formData.get('title') as string)?.trim();
  if (!title) return { error: 'Goal title is required.' };

  const { error } = await supabase.from('development_goals').insert({
    player_id: playerId,
    team_id: teamId,
    club_id: clubId,
    skill_id: (formData.get('skillId') as string) || null,
    title,
    description: (formData.get('description') as string)?.trim() || null,
    starting_level: toLevel(formData.get('startingLevel')),
    target_level: toLevel(formData.get('targetLevel')),
    current_level: toLevel(formData.get('startingLevel')),
    start_date: (formData.get('startDate') as string) || null,
    target_date: (formData.get('targetDate') as string) || null,
    success_criteria: (formData.get('successCriteria') as string)?.trim() || null,
    visibility: (formData.get('visibility') as string) || 'coach_only',
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateGoal(goalId: string, formData: FormData) {
  const supabase = await createClient();
  const toLevel = (v: FormDataEntryValue | null) => {
    const n = parseInt((v as string) ?? '', 10);
    return isNaN(n) ? null : n;
  };

  const { error } = await supabase
    .from('development_goals')
    .update({
      status: formData.get('status') as string,
      current_level: toLevel(formData.get('currentLevel')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId);

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function addNote(playerId: string, teamId: string, clubId: string, formData: FormData) {
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const note = (formData.get('note') as string)?.trim();
  if (!note) return { error: 'Note text is required.' };

  const { error } = await supabase.from('player_development_notes').insert({
    player_id: playerId,
    team_id: teamId,
    club_id: clubId,
    note,
    visibility: (formData.get('visibility') as string) || 'coach_only',
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

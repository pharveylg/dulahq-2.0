'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function createExpense(clubId: string, formData: FormData) {
  const description = (formData.get('description') as string)?.trim();
  const amount = parseFloat((formData.get('amount') as string) ?? '');
  const category = formData.get('category') as string;

  if (!description) return { error: 'Description is required.' };
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount.' };
  if (!category) return { error: 'Choose a category.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('expenses').insert({
    club_id: clubId,
    description,
    amount,
    category,
    currency: (formData.get('currency') as string) || 'USD',
    expense_date: (formData.get('expenseDate') as string) || new Date().toISOString().slice(0, 10),
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

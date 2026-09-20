'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501') return "You don't have permission to do that.";
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '23514') return 'One of the values is not allowed.';
  if (error.code === '23503') return 'That is still referenced by something else.';
  // The RPCs raise readable messages ("no Dula HQ account exists for that
  // email", "that person already has this role...") -- pass those through.
  return error.message;
}

function refresh() {
  revalidatePath('/tm/[orgSlug]/[tournamentSlug]', 'page');
}

const clean = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const numberOrNull = (v: FormDataEntryValue | null) => {
  const s = clean(v);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Accept or decline an entry. Always through decide_tournament_entry, never a
 * direct UPDATE: the RPC is the audited path and, on acceptance, is what
 * invites the entry's team_manager contact.
 */
export async function decideEntry(entryId: string, status: 'accepted' | 'declined') {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_tournament_entry', { p_entry_id: entryId, p_status: status });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

/**
 * Host-entered registration: the organizer records a team that registered
 * with them. Entries are always created 'pending' (RLS enforces it) -- the
 * decision is a separate, audited step. The contact and the optional
 * entry-fee invoice are best-effort follow-ons: if either fails the entry
 * still exists, and the caller is told exactly what didn't happen rather than
 * being handed an error for a row that was in fact created.
 */
export async function addEntry(tournamentId: string, formData: FormData) {
  const teamName = clean(formData.get('teamName'));
  const categoryId = clean(formData.get('categoryId')) || null;
  const contactName = clean(formData.get('contactName'));
  const contactEmail = clean(formData.get('contactEmail')).toLowerCase();
  const contactRole = clean(formData.get('contactRole')) === 'coach' ? 'coach' : 'team_manager';
  const issueInvoice = formData.get('issueInvoice') === 'on';
  if (!teamName) return { error: 'Team name is required.' };
  if ((contactName && !contactEmail) || (!contactName && contactEmail)) {
    return { error: 'A contact needs both a name and an email.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in first.' };

  const { data: tournament } = await supabase.from('tournaments').select('org_id').eq('id', tournamentId).maybeSingle();
  if (!tournament?.org_id) return { error: 'Tournament not found.' };
  const hostOrgId = tournament.org_id;

  let category: { id: string; name: string; entry_fee: number | null; capacity: number | null } | null = null;
  if (categoryId) {
    const { data } = await supabase
      .from('tournament_categories')
      .select('id, name, entry_fee, capacity')
      .eq('id', categoryId)
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (!data) return { error: 'That category does not belong to this tournament.' };
    category = data;

    if (category.capacity != null) {
      const { count } = await supabase
        .from('tournament_entries')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .in('status', ['pending', 'accepted']);
      if ((count ?? 0) >= category.capacity) {
        return { error: `${category.name} is full (${category.capacity} entries). Raise its capacity to add more.` };
      }
    }
  }

  const { data: entry, error: entryError } = await supabase
    .from('tournament_entries')
    .insert({
      tournament_id: tournamentId,
      host_org_id: hostOrgId,
      category_id: categoryId,
      team_name: teamName,
      status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (entryError || !entry) return { error: friendlyError(entryError ?? { message: 'Could not create the entry.' }) };

  await supabase.rpc('write_audit', {
    p_org_id: hostOrgId,
    p_action: 'tournament_entry.created',
    p_scope_type: 'tournament',
    p_scope_id: tournamentId,
    p_entity_type: 'tournament_entry',
    p_entity_id: entry.id,
    p_after: { team_name: teamName, category_id: categoryId },
  });

  const warnings: string[] = [];

  if (contactName && contactEmail) {
    const { error } = await supabase.from('tournament_entry_contacts').insert({
      entry_id: entry.id,
      org_id: hostOrgId,
      name: contactName,
      email: contactEmail,
      role: contactRole,
      created_by: user.id,
    });
    if (error) warnings.push(`The entry was created but the contact was not saved: ${friendlyError(error)}`);
  }

  if (issueInvoice && category?.entry_fee && category.entry_fee > 0) {
    const { data: account } = await (supabase as any)
      .from('billing_accounts')
      .select('id')
      .eq('context_type', 'tournament')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (!account) {
      warnings.push('The entry was created but no invoice was issued: this tournament has no billing account you can use.');
    } else {
      const { error } = await (supabase as any).rpc('create_billing_invoice', {
        p_org_id: hostOrgId,
        p_billing_account_id: account.id,
        p_context_type: 'tournament',
        p_payer_type: 'team',
        p_payer_label: teamName,
        p_source_type: 'tournament_entry',
        p_source_id: entry.id,
        p_lines: [{
          description: `${category.name} registration fee`,
          quantity: 1,
          unit_amount: category.entry_fee,
          source_type: 'tournament_entry',
          source_id: entry.id,
        }],
      });
      if (error) warnings.push(`The entry was created but no invoice was issued: ${friendlyError(error)}`);
    }
  }

  refresh();
  return { success: true, warnings };
}

export async function saveCategory(tournamentId: string, formData: FormData) {
  const id = clean(formData.get('id')) || null;
  const name = clean(formData.get('name'));
  const ageGroup = clean(formData.get('ageGroup')) || null;
  const format = clean(formData.get('format')) || null;
  const entryFee = numberOrNull(formData.get('entryFee'));
  const capacity = numberOrNull(formData.get('capacity'));
  if (!name) return { error: 'Category name is required.' };
  if (entryFee !== null && (Number.isNaN(entryFee) || entryFee < 0)) return { error: 'Entry fee must be zero or more.' };
  if (capacity !== null && (Number.isNaN(capacity) || !Number.isInteger(capacity) || capacity < 1)) {
    return { error: 'Capacity must be a whole number of at least 1.' };
  }

  const supabase = await createClient();
  const { data: tournament } = await supabase.from('tournaments').select('org_id').eq('id', tournamentId).maybeSingle();
  if (!tournament?.org_id) return { error: 'Tournament not found.' };

  const values = { name, age_group: ageGroup, format, entry_fee: entryFee, capacity };
  if (id) {
    const { data, error } = await supabase.from('tournament_categories').update(values).eq('id', id).eq('tournament_id', tournamentId).select('id');
    if (error) return { error: friendlyError(error) };
    // RLS filters an unauthorized UPDATE to zero rows instead of raising, so
    // the row count is the only signal there is.
    if (!data || data.length === 0) return { error: "You don't have permission to change that category." };
  } else {
    const { error } = await supabase.from('tournament_categories').insert({ ...values, tournament_id: tournamentId, org_id: tournament.org_id });
    if (error) return { error: friendlyError(error) };
  }
  refresh();
  return { success: true };
}

export async function deleteCategory(tournamentId: string, categoryId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId);
  if ((count ?? 0) > 0) {
    return { error: `${count} ${count === 1 ? 'entry uses' : 'entries use'} this category. Move or remove them first.` };
  }
  const { data, error } = await supabase
    .from('tournament_categories')
    .delete()
    .eq('id', categoryId)
    .eq('tournament_id', tournamentId)
    .select('id');
  if (error) return { error: friendlyError(error) };
  if (!data || data.length === 0) return { error: "You don't have permission to delete that category." };
  refresh();
  return { success: true };
}

export async function addStaff(tournamentId: string, formData: FormData) {
  const email = clean(formData.get('email')).toLowerCase();
  const role = clean(formData.get('role'));
  if (!email || !role) return { error: 'Email and role are required.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_tournament_staff', { p_tournament_id: tournamentId, p_email: email, p_role: role });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

export async function setStaffStatus(tournamentId: string, userId: string, status: 'active' | 'suspended') {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_tournament_staff_account_status', {
    p_tournament_id: tournamentId,
    p_target_user_id: userId,
    p_status: status,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

/**
 * "Remove" archives, matching the club side: the row survives so the
 * tournament keeps a record of who staffed it, while every authorization
 * helper already requires status='active'.
 */
export async function archiveStaff(tournamentId: string, userId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId) return { error: "You can't remove yourself. Ask another organizer to do it." };

  const { data: tournament } = await supabase.from('tournaments').select('org_id').eq('id', tournamentId).maybeSingle();
  const { data, error } = await supabase
    .from('tournament_staff')
    .update({ status: 'archived' })
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('role', role)
    .select('id');
  if (error) return { error: friendlyError(error) };
  if (!data || data.length === 0) return { error: "You don't have permission to remove that person." };

  if (tournament?.org_id) {
    await supabase.rpc('write_audit', {
      p_org_id: tournament.org_id,
      p_action: 'tournament_staff.archived',
      p_scope_type: 'tournament',
      p_scope_id: tournamentId,
      p_entity_type: 'tournament_staff',
      p_entity_id: data[0].id,
      p_after: { user_id: userId, role },
    });
  }
  refresh();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Finance. Authorization lives in the RPCs (can_review_billing_invoice: org
// admin or manage_tournament_finances); these just carry the request and turn
// the error into something a person can act on.
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'qr_transfer', 'other'] as const;

/** Record a payment the host received directly (cash, or a transfer seen on their own statement). */
export async function recordPayment(invoiceId: string, formData: FormData) {
  const amount = numberOrNull(formData.get('amount'));
  const method = clean(formData.get('method'));
  if (amount == null || Number.isNaN(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return { error: 'Choose how it was paid.' };

  const supabase = (await createClient()) as any; // billing isn't in database.types.ts yet
  const { error } = await supabase.rpc('record_billing_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_reference_number: clean(formData.get('reference')) || undefined,
    p_note: clean(formData.get('note')) || undefined,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

/** Verify or reject a payment a payer submitted. Rejecting needs a reason the payer can act on. */
export async function reviewPayment(paymentId: string, status: 'verified' | 'rejected', note: string) {
  const reason = note.trim();
  if (status === 'rejected' && !reason) return { error: 'Say why it was rejected so the payer knows what to fix.' };
  const supabase = (await createClient()) as any;
  const { error } = await supabase.rpc('review_billing_payment', {
    p_payment_id: paymentId,
    p_status: status,
    p_reviewer_note: reason || undefined,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

/**
 * The instructions payers read before paying. The QR image key is passed back
 * unchanged: the RPC overwrites both fields, so omitting it would erase a QR
 * that Platform Admin had uploaded.
 */
export async function saveInstructions(accountId: string, formData: FormData) {
  const supabase = (await createClient()) as any;
  const { data: account } = await supabase.from('billing_accounts').select('qr_storage_key').eq('id', accountId).maybeSingle();
  if (!account) return { error: 'Billing account not found.' };
  const { error } = await supabase.rpc('update_billing_account_instructions', {
    p_account_id: accountId,
    p_payment_instructions: clean(formData.get('instructions')),
    p_qr_storage_key: account.qr_storage_key ?? undefined,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: true };
}

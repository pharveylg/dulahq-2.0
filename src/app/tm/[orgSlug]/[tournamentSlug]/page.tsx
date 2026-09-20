import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TournamentTabs from './TournamentTabs';
import EntryQueue, { type Entry, type CategoryOption } from './EntryQueue';
import Categories, { type Category } from './Categories';
import StaffPanel, { type StaffMember, type AuditRow } from './StaffPanel';
import Finance, { type FinanceInvoice, type PendingPayment } from './Finance';

/**
 * The native organizer workspace for one tournament
 * (docs/tournament-organizer-console-proposal.md). Everything is
 * permission-gated, not role-gated: an org admin is treated as holding every
 * tournament permission (mirroring the RLS policies, which all keep an
 * is_org_admin path), and everyone else needs the specific catalog key.
 *
 * The bracket/scores engine is NOT here -- it stays the proxied app at
 * /t/:orgSlug/:tournamentSlug, linked from the header.
 */
export default async function TournamentConsolePage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, org_id, venue, event_date, organizations!inner(slug, name)')
    .eq('slug', tournamentSlug)
    .eq('organizations.slug', orgSlug)
    .maybeSingle();
  if (!tournament) notFound();

  const tournamentId = tournament.id;
  const orgId = tournament.org_id as string;
  const org = tournament.organizations as unknown as { slug: string; name: string };

  const perm = (key: string) => supabase.rpc('has_tournament_permission', { p_permission_key: key, p_tournament_id: tournamentId });
  const [
    { data: orgAdmin },
    { data: isStaff },
    { data: pDecide },
    { data: pManage },
    { data: pCompetition },
    { data: pStaff },
    { data: pAccountStatus },
    { data: pAudit },
    { data: pViewFinance },
    { data: pManageFinance },
  ] = await Promise.all([
    supabase.rpc('is_org_admin', { org: orgId }),
    supabase.rpc('is_tournament_staff', { check_tournament_id: tournamentId }),
    perm('decide_tournament_entry'),
    perm('manage_tournament'),
    perm('manage_competition'),
    perm('manage_tournament_staff'),
    perm('manage_account_status'),
    perm('view_audit_log'),
    perm('view_tournament_finances'),
    perm('manage_tournament_finances'),
  ]);

  // RLS already hides the tournament from anyone else; this is the explicit
  // version of the same rule, so a page that loads is a page they may use.
  if (!orgAdmin && !isStaff) notFound();

  const can = (granted: boolean | null) => !!orgAdmin || !!granted;
  const canDecide = can(pDecide);
  const canAddEntries = can(pManage);
  const canManageCategories = can(pCompetition);
  const canManageStaff = can(pStaff);
  const canAccountStatus = can(pAccountStatus);
  const canViewAudit = can(pAudit);
  const canManageFinance = can(pManageFinance);
  const showFinanceTab = canManageFinance || can(pViewFinance);

  const [{ data: entryRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from('tournament_entries')
      .select('id, team_name, status, category_id, club_id, created_at, tournament_categories(name)')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tournament_categories')
      .select('id, name, age_group, format, entry_fee, capacity, sort_order')
      .eq('tournament_id', tournamentId)
      .order('sort_order')
      .order('name'),
  ]);

  const entryIds = (entryRows ?? []).map((e) => e.id);
  const { data: contactRows } = entryIds.length
    ? await supabase
        .from('tournament_entry_contacts')
        .select('entry_id, name, email, role, account_status')
        .in('entry_id', entryIds)
    : { data: [] };

  const contactsByEntry = new Map<string, Entry['contacts']>();
  for (const c of contactRows ?? []) {
    const list = contactsByEntry.get(c.entry_id) ?? [];
    list.push({ name: c.name, email: c.email, role: c.role, accountStatus: c.account_status });
    contactsByEntry.set(c.entry_id, list);
  }

  const entries: Entry[] = (entryRows ?? []).map((e: any) => ({
    id: e.id,
    teamName: e.team_name,
    status: e.status,
    categoryName: e.tournament_categories?.name ?? null,
    clubBacked: !!e.club_id,
    createdAt: e.created_at,
    contacts: contactsByEntry.get(e.id) ?? [],
  }));

  // Pending and accepted entries hold a place; declined and withdrawn don't.
  const taken = new Map<string, number>();
  for (const e of entryRows ?? []) {
    if (e.category_id && (e.status === 'pending' || e.status === 'accepted')) {
      taken.set(e.category_id, (taken.get(e.category_id) ?? 0) + 1);
    }
  }
  const categories: Category[] = (categoryRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    ageGroup: c.age_group,
    format: c.format,
    entryFee: c.entry_fee != null ? Number(c.entry_fee) : null,
    capacity: c.capacity,
    taken: taken.get(c.id) ?? 0,
  }));
  const categoryOptions: CategoryOption[] = categories.map(({ id, name, entryFee, capacity, taken: t }) => ({
    id, name, entryFee, capacity, taken: t,
  }));

  const showStaffTab = canManageStaff || canAccountStatus || canViewAudit;
  let staff: StaffMember[] = [];
  let audit: AuditRow[] | null = null;
  if (showStaffTab) {
    const { data: directory } = await supabase.rpc('tournament_staff_directory', { p_tournament_id: tournamentId });
    staff = (directory ?? []).map((s) => ({ userId: s.user_id, name: s.name, email: s.email, role: s.role, status: s.status }));
    if (canViewAudit) {
      const { data: log } = await supabase.rpc('tournament_audit_log', { p_tournament_id: tournamentId });
      audit = (log ?? []).slice(0, 50).map((r) => ({ id: r.id, ts: r.ts, actorEmail: r.actor_email, action: r.action }));
    }
  }


  // Finance. Billing isn't in database.types.ts, so this reads through an untyped client like the rest of the billing code.
  let financeAccountId: string | null = null;
  let financeInstructions = '';
  let financeInvoices: FinanceInvoice[] = [];
  let pendingPayments: PendingPayment[] = [];
  if (showFinanceTab) {
    const db = supabase as any;
    const { data: account } = await db
      .from('billing_accounts')
      .select('id, payment_instructions')
      .eq('context_type', 'tournament')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (account) {
      financeAccountId = account.id;
      financeInstructions = account.payment_instructions ?? '';
      const { data: invoiceRows } = await db
        .from('billing_invoices')
        .select('id, invoice_number, payer_label, total, amount_paid, status, currency, due_at')
        .eq('billing_account_id', account.id)
        .order('created_at', { ascending: false });
      financeInvoices = (invoiceRows ?? []).map((i: any) => ({
        id: i.id, number: i.invoice_number, payer: i.payer_label, total: Number(i.total), paid: Number(i.amount_paid),
        status: i.status, currency: i.currency, dueAt: i.due_at,
      }));
      const invoiceIds = financeInvoices.map((i) => i.id);
      if (invoiceIds.length) {
        const { data: paymentRows } = await db
          .from('billing_payment_submissions')
          .select('id, invoice_id, amount, currency, method, reference_number, payer_note, submitted_at')
          .in('invoice_id', invoiceIds)
          .in('status', ['submitted', 'under_review'])
          .order('submitted_at');
        pendingPayments = (paymentRows ?? []).map((p: any) => ({
          id: p.id, invoiceId: p.invoice_id, amount: Number(p.amount), currency: p.currency, method: p.method,
          reference: p.reference_number, payerNote: p.payer_note, submittedAt: p.submitted_at,
        }));
      }
    }
  }

  const pendingCount = entries.filter((e) => e.status === 'pending').length;

  return (
    <main className="page">
      <div className="container">
        <Link href="/tournaments" className="back-link">← Tournaments</Link>

        <div className="page-header">
          <div>
            <h1>{tournament.name}</h1>
            <p className="subtitle">
              {org.name}
              {tournament.event_date ? ` · ${new Date(tournament.event_date).toLocaleDateString()}` : ''}
              {tournament.venue ? ` · ${tournament.venue}` : ''}
            </p>
          </div>
          <Link href={`/t/${org.slug}/${tournament.slug}`} className="btn">Open tournament engine</Link>
        </div>

        <TournamentTabs
          pendingCount={pendingCount}
          categoryCount={categories.length}
          financeBadge={pendingPayments.length}
          entriesSlot={
            <EntryQueue
              tournamentId={tournamentId}
              entries={entries}
              categories={categoryOptions}
              canDecide={canDecide}
              canAdd={canAddEntries}
            />
          }
          categoriesSlot={<Categories tournamentId={tournamentId} categories={categories} canManage={canManageCategories} />}
          financeSlot={
            showFinanceTab ? (
              <Finance
                accountId={financeAccountId}
                instructions={financeInstructions}
                invoices={financeInvoices}
                pendingPayments={pendingPayments}
                canManage={canManageFinance}
              />
            ) : null
          }
          staffSlot={
            showStaffTab ? (
              <StaffPanel
                tournamentId={tournamentId}
                currentUserId={user.id}
                staff={staff}
                audit={audit}
                canManage={canManageStaff}
                canAccountStatus={canAccountStatus}
              />
            ) : null
          }
        />
      </div>
    </main>
  );
}

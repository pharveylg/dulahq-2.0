import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TournamentTabs from './TournamentTabs';
import EntryQueue, { type Entry, type CategoryOption } from './EntryQueue';
import Categories, { type Category } from './Categories';
import StaffPanel, { type StaffMember, type AuditRow } from './StaffPanel';
import Finance, { type FinanceInvoice, type PendingPayment } from './Finance';
import Announcements, { type AnnouncementRow } from './Announcements';
import PublicListingCard from '@/components/PublicListingCard';
import ProvisionLoginPanel from '@/components/ProvisionLoginPanel';

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
    .select('id, name, slug, org_id, venue, event_date, poster_url, publicly_listed, listing_blocked, listing_block_reason, organizations!inner(slug, name)')
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
    { data: pListing },
    { data: pLogins },
    { data: pReview },
    { data: pComms },
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
    perm('manage_tournament_listing'),
    perm('manage_tournament_logins'),
    perm('review_tournament_entry'),
    perm('manage_tournament_communications'),
  ]);

  // RLS already hides the tournament from anyone else; this is the explicit
  // version of the same rule, so a page that loads is a page they may use.
  if (!orgAdmin && !isStaff) notFound();

  const can = (granted: boolean | null) => !!orgAdmin || !!granted;
  const canDecide = can(pDecide);
  const canReview = can(pReview);
  const canPostAnnouncements = can(pComms);
  const canAddEntries = can(pManage);
  const canManageCategories = can(pCompetition);
  const canManageStaff = can(pStaff);
  const canAccountStatus = can(pAccountStatus);
  const canViewAudit = can(pAudit);
  const canManageFinance = can(pManageFinance);
  const showFinanceTab = canManageFinance || can(pViewFinance);
  // Listing: the tournament IT admin and org admin turn it on; the Organizer
  // (manage_tournament) can take it down.
  const canList = can(pListing);
  const showListingTab = canList || canAddEntries;

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

  // Coordinator notes and flags (review_tournament_entry). RLS already limits who reads them.
  const { data: noteRows } = canReview && entryIds.length
    ? await (supabase as any)
        .from('tournament_entry_notes')
        .select('id, entry_id, kind, body, resolved_at, created_by, created_at, author_name')
        .in('entry_id', entryIds)
        .order('created_at', { ascending: false })
    : { data: [] };
  const notesByEntry = new Map<string, Entry['notes']>();
  for (const n of (noteRows ?? []) as any[]) {
    const list = notesByEntry.get(n.entry_id) ?? [];
    list.push({ id: n.id, kind: n.kind, body: n.body, resolved: !!n.resolved_at, mine: n.created_by === user.id, author: n.author_name ?? null, createdAt: n.created_at });
    notesByEntry.set(n.entry_id, list);
  }

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
    notes: notesByEntry.get(e.id) ?? [],
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

  // Logins: the raw permission, NOT can() -- an org admin doesn't create logins for a tournament's people; that is the tournament IT admin's job.
  const canLogins = !!pLogins;
  // Announcements: whoever can post also sees the history.
  const { data: announcementRows } = canPostAnnouncements
    ? await (supabase as any)
        .from('tournament_announcements')
        .select('id, title, body, audience, author_name, created_at, retracted_at')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: null };
  const announcements: AnnouncementRow[] = ((announcementRows ?? []) as any[]).map((a) => ({
    id: a.id, title: a.title, body: a.body, audience: a.audience, authorName: a.author_name, createdAt: a.created_at, retracted: !!a.retracted_at,
  }));

  const showStaffTab = canManageStaff || canAccountStatus || canViewAudit || canLogins;
  const { data: loginRows } = canLogins
    ? await supabase.from('provisioned_logins').select('user_id, email, name, last_issued_at, temp_expires_at, activated_at, expired_at')
        .eq('scope_type', 'tournament').eq('scope_id', tournamentId).order('last_issued_at', { ascending: false })
    : { data: null };
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
          listingSlot={
            showListingTab ? (
              <PublicListingCard
                kind="tournament"
                id={tournamentId}
                listed={tournament.publicly_listed}
                blocked={tournament.listing_blocked}
                blockReason={tournament.listing_block_reason}
                canList={canList}
                canUnlist
                preview={{
                  fields: [
                    { label: 'Name', value: tournament.name },
                    { label: 'Organizer', value: org.name },
                    { label: 'Date', value: tournament.event_date ? new Date(tournament.event_date).toLocaleDateString() : null },
                    { label: 'Venue', value: tournament.venue },
                    { label: 'Poster', value: tournament.poster_url ? 'uploaded' : null },
                  ],
                }}
              />
            ) : null
          }
          entriesSlot={
            <EntryQueue
              tournamentId={tournamentId}
              entries={entries}
              categories={categoryOptions}
              canDecide={canDecide}
              canAdd={canAddEntries}
              canReview={canReview}
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
          announcementsSlot={canPostAnnouncements ? <Announcements tournamentId={tournamentId} rows={announcements} canPost /> : null}
          staffSlot={
            showStaffTab ? (
              <>
                {canLogins && (
                  <>
                    <div className="section-label">Create a login</div>
                    <ProvisionLoginPanel scope="tournament" scopeId={tournamentId} logins={loginRows ?? []} />
                  </>
                )}
                <StaffPanel
                  tournamentId={tournamentId}
                  currentUserId={user.id}
                  staff={staff}
                  audit={audit}
                  canManage={canManageStaff}
                  canAccountStatus={canAccountStatus}
                />
              </>
            ) : null
          }
        />
      </div>
    </main>
  );
}

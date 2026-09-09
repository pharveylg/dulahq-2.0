import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SupportRequestForm from './SupportRequestForm';
import SupportThread from './SupportThread';

/**
 * P1-10 (gap analysis §12): a real escalation path to Platform Admin,
 * scoped by org_id -- support_requests_read's RLS is what actually decides
 * who sees what here; this page just renders whatever comes back, which is
 * "requests I filed, plus every request at this org if I hold
 * submit_support_request at some club in it" (created_by=self is included
 * specifically so a request filed before someone's permission changed, or
 * by someone who has since left, doesn't just disappear from the org's own
 * view for everyone else who still holds it).
 */
export default async function SupportPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, name, slug, org_id').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();

  const { data: canSubmit } = await supabase.rpc('has_staff_permission', {
    p_permission_key: 'submit_support_request',
    p_club_id: club.id,
  });

  const { data: requests } = await supabase
    .from('support_requests')
    .select('id, category, subject, body, status, created_at, created_by')
    .eq('org_id', club.org_id)
    .order('created_at', { ascending: false });

  const requestIds = (requests ?? []).map((r) => r.id);
  const { data: messageRows } = requestIds.length
    ? await supabase
        .from('support_request_messages')
        .select('id, request_id, author_user_id, body, created_at')
        .in('request_id', requestIds)
        .order('created_at')
    : { data: [] };

  const authorIds = [...new Set([
    ...(requests ?? []).map((r) => r.created_by),
    ...(messageRows ?? []).map((m) => m.author_user_id),
  ])];
  const { data: authorRows } = authorIds.length
    ? await supabase.from('users').select('id, name, email').in('id', authorIds)
    : { data: [] };
  // Some authors (a platform admin replying, or a club member who isn't
  // one of THIS caller's fellow club_staff) may not be readable via
  // public.users' own self-row-only policy -- fall back to "Dulà HQ team"
  // for a platform reply, "A club member" otherwise, rather than showing
  // nothing.
  const authorById = new Map((authorRows ?? []).map((a) => [a.id, a]));

  const messagesByRequest = new Map<string, { id: string; authorName: string; body: string; createdAt: string }[]>();
  for (const m of messageRows ?? []) {
    const list = messagesByRequest.get(m.request_id) ?? [];
    const author = authorById.get(m.author_user_id);
    list.push({ id: m.id, authorName: author?.name ?? author?.email ?? 'Dulà HQ team', body: m.body, createdAt: m.created_at });
    messagesByRequest.set(m.request_id, list);
  }

  const items = (requests ?? []).map((r) => {
    const author = authorById.get(r.created_by);
    return {
      id: r.id,
      category: r.category,
      subject: r.subject,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      createdByName: author?.name ?? author?.email ?? 'A club member',
      isMine: r.created_by === user.id,
      messages: messagesByRequest.get(r.id) ?? [],
    };
  });

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}`} className="back-link">← {club.name}</Link>
        <div className="page-header">
          <div>
            <h1>Support</h1>
            <p className="subtitle">Escalate an issue to the Dulà HQ platform team.</p>
          </div>
        </div>

        {!canSubmit && items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            You don&apos;t hold the permission to submit a support request at this club, and none exist yet.
          </p>
        )}

        {canSubmit && <SupportRequestForm clubId={club.id} />}

        {items.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Requests ({items.length})</div>
            {items.map((item) => (
              <SupportThread key={item.id} item={item} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

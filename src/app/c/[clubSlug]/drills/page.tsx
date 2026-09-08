import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess } from '@/lib/supabase/server';
import DrillList from './DrillList';

export default async function DrillsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, slug, name').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();
  const clubId = club.id;

  const access = await getClubAccess(clubId);
  const canManage = access.isStaff;

  const { data: drills, error } = await supabase
    .from('drills')
    .select('id, name, description, category, theme, age_min, age_max, player_min, player_max, duration_minutes, difficulty, equipment, objective, coaching_points, skills')
    .eq('club_id', clubId)
    .order('name');

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}`} className="back-link">← {club.name}</Link>

        <div className="page-header">
          <div>
            <h1>Drill library</h1>
            <p className="subtitle">{drills?.length ?? 0} drill{(drills?.length ?? 0) === 1 ? '' : 's'}</p>
          </div>
        </div>

        {error && <p className="error-text">Couldn&apos;t load drills: {error.message}</p>}

        <DrillList clubId={clubId} drills={drills ?? []} canManage={canManage} />
      </div>
    </main>
  );
}

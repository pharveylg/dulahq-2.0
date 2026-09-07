'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createClub } from './actions';

type Org = { id: string; name: string };
type Sport = { id: string; key: string; name: string; status: string };
type ActionState = { error?: string };
const initialState: ActionState = {};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function NewClubForm({ orgs, sports }: { orgs: Org[]; sports: Sport[] }) {
  const defaultSport = sports.find((s) => s.status === 'production') ?? sports[0];
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (_prev, formData) => {
    const result = await createClub(formData);
    return result ?? {};
  }, initialState);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <Link href="/clubs" className="back-link">← Clubs</Link>
        <div className="page-header">
          <h1>New club</h1>
        </div>

        <form action={formAction} className="card">
          <div className="form-group">
            <label htmlFor="name">Club name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="slug">URL slug</label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              pattern="[a-z0-9-]+"
              title="lowercase letters, numbers, hyphens only"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            />
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              /clubs/{slug || '…'}
            </p>
          </div>
          {sports.length > 0 && (
            <div className="form-group">
              <label htmlFor="sport_id">Sport</label>
              <select id="sport_id" name="sport_id" required defaultValue={defaultSport?.id}>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id} disabled={sport.status !== 'production'}>
                    {sport.name}{sport.status !== 'production' ? ' (coming soon)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {orgs.length === 1 ? (
            <input type="hidden" name="org_id" value={orgs[0].id} />
          ) : (
            <div className="form-group">
              <label htmlFor="org_id">Organization</label>
              <select id="org_id" name="org_id" required defaultValue="">
                <option value="" disabled>Choose an organization…</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          {orgs.length === 1 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
              Organization: {orgs[0].name}
            </p>
          )}
          {state?.error && <p className="error-text">{state.error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={pending}>
            {pending ? 'Creating…' : 'Create club'}
          </button>
        </form>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
          After creating the club, add yourself or someone else as{' '}
          <span className="chip chip-club_admin">club_admin</span> on the club&apos;s
          page — an admin doesn&apos;t automatically become club staff.
        </p>
      </div>
    </main>
  );
}

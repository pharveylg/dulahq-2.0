'use client';

import { useActionState, useState } from 'react';
import { provisionTenant } from './actions';

type ActionState = { error?: string; success?: boolean; orgName?: string; adminEmail?: string };
const initialState: ActionState = {};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ProvisionForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await provisionTenant(formData)) ?? {},
    initialState
  );
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [clubSlug, setClubSlug] = useState('');
  const [clubSlugTouched, setClubSlugTouched] = useState(false);
  const [products, setProducts] = useState<{ club: boolean; tournament: boolean }>({ club: false, tournament: false });
  const [tournamentSlug, setTournamentSlug] = useState('');
  const [tournamentSlugTouched, setTournamentSlugTouched] = useState(false);

  function toggleProduct(product: 'club' | 'tournament') {
    setProducts((p) => ({ ...p, [product]: !p[product] }));
  }

  return (
    <div className="card">
      {state?.success && (
        <p style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 12 }}>
          Tenant "{state.orgName}" created — {state.adminEmail} can sign in and will land on /clubs.
        </p>
      )}
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Organizer / business name</label>
          <input name="name" placeholder="e.g. Rally Point Sports" required onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Org slug</label>
          <input name="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} required pattern="[a-z0-9-]+" />
        </div>
        <div className="form-row" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Accent color</label>
            <input name="accent" type="color" defaultValue="#15803D" style={{ padding: 2, height: 38, width: 70 }} />
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
            <label>Admin email</label>
            <input name="adminEmail" type="email" placeholder="admin@example.com" required />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
            Product entitlements
          </label>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
            What this org is allowed to create — without one, its own admin can&apos;t insert a club or tournament.
          </p>
          <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
              <input type="checkbox" name="products" value="club" checked={products.club} onChange={() => toggleProduct('club')} />
              Club
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
              <input type="checkbox" name="products" value="tournament" checked={products.tournament} onChange={() => toggleProduct('tournament')} />
              Tournament
            </label>
          </div>
        </div>

        {products.club && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>Optionally create the tenant's first club now:</p>
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
                <input name="clubName" placeholder="First club name (optional)" onChange={(e) => { if (!clubSlugTouched) setClubSlug(slugify(e.target.value)); }} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                <input name="clubSlug" placeholder="club-slug" value={clubSlug} onChange={(e) => { setClubSlug(e.target.value); setClubSlugTouched(true); }} pattern="[a-z0-9-]+" />
              </div>
            </div>
          </div>
        )}

        {products.tournament && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>Optionally create the tenant's first tournament now:</p>
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
                <input name="tournamentName" placeholder="First tournament name (optional)" onChange={(e) => { if (!tournamentSlugTouched) setTournamentSlug(slugify(e.target.value)); }} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                <input name="tournamentSlug" placeholder="tournament-slug" value={tournamentSlug} onChange={(e) => { setTournamentSlug(e.target.value); setTournamentSlugTouched(true); }} pattern="[a-z0-9-]+" />
              </div>
            </div>
          </div>
        )}

        {state?.error && <p className="error-text">{state.error}</p>}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create tenant'}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { createSelfServeOrganization } from './actions';

type ActionState = { error?: string };
const initialState: ActionState = {};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function NewOrgForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createSelfServeOrganization(formData)) ?? {},
    initialState
  );
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="page-header">
          <h1>Create your organization</h1>
        </div>
        <p className="subtitle" style={{ marginBottom: 16 }}>
          This becomes your workspace. You can add a club or tournament trial next, or
          just look around first.
        </p>
        <form action={formAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Organization name</label>
            <input
              name="name"
              placeholder="e.g. Rally Point Sports"
              required
              onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Web address</label>
            <input
              name="slug"
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              pattern="[a-z0-9-]+"
              placeholder="rally-point-sports"
            />
          </div>
          {state?.error && <p className="error-text">{state.error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create organization'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            If you don&apos;t choose a product within 24 hours, this organization is
            removed automatically. Starting a trial stops that clock.
          </p>
        </form>
      </div>
    </main>
  );
}

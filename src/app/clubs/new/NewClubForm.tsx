'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createClub } from './actions';

type ActionState = { error?: string };
const initialState: ActionState = {};

export default function NewClubForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (_prev, formData) => {
    const result = await createClub(formData);
    return result ?? {};
  }, initialState);

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
            <input id="name" name="name" type="text" required autoFocus />
          </div>
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

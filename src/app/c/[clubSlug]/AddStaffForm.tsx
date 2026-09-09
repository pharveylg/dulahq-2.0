'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addStaff } from './actions';

// Must stay in step with club_staff_role_check (phase6k/phase6l). Ordered
// roughly by breadth of authority so the picker reads as a hierarchy.
const ROLES = [
  'club_manager',
  'team_manager',
  'coach',
  'assistant_coach',
  'treasurer',
  'secretary',
  'staff',
];

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

export default function AddStaffForm({ clubId }: { clubId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await addStaff(clubId, formData)) ?? {},
    initialState
  );

  // Clear the form after a successful add -- without this, the email
  // field kept showing the just-submitted address even after the staff
  // list below refreshed, making it look like the add hadn't registered.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card" style={{ marginTop: 16 }}>
      <div className="section-label">Add staff</div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="person@example.com" required />
        </div>
        <div className="form-group" style={{ flex: '0 0 160px' }}>
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="coach">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {state?.error && <p className="error-text">{state.error}</p>}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
        The person must already have a Dula HQ account — this doesn't create new ones.
      </p>
    </form>
  );
}

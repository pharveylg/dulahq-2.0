'use client';

import { useState, useTransition, useActionState } from 'react';
import { createDrill, deleteDrill } from './actions';

type Drill = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  theme: string | null;
  age_min: number | null;
  age_max: number | null;
  player_min: number | null;
  player_max: number | null;
  duration_minutes: number | null;
  difficulty: string | null;
  equipment: string | null;
  objective: string | null;
  coaching_points: string | null;
  skills: string[];
};

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

const CATEGORIES = [
  { value: 'technical', label: 'Technical' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'physical', label: 'Physical' },
  { value: 'position_specific', label: 'Position specific' },
];

function DrillCard({ drill, canManage }: { drill: Drill; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDrill(drill.id);
      if (result?.error) setError(result.error);
    });
  }

  const meta = [
    CATEGORIES.find((c) => c.value === drill.category)?.label,
    drill.theme,
    drill.duration_minutes ? `${drill.duration_minutes} min` : null,
    drill.difficulty,
    (drill.player_min || drill.player_max) ? `${drill.player_min ?? '?'}-${drill.player_max ?? '?'} players` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
        <div className="list-row-main">
          <div className="list-row-title">{drill.name}</div>
          <div className="list-row-meta">{meta}</div>
        </div>
        {canManage && (
          <button
            className="btn"
            style={{ fontSize: 11 }}
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={pending}
          >
            Delete
          </button>
        )}
      </div>
      {drill.skills.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {drill.skills.map((s) => <span key={s} className="chip" style={{ fontSize: 10.5 }}>{s}</span>)}
        </div>
      )}
      {expanded && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingLeft: 2 }}>
          {drill.description && <p style={{ margin: '4px 0' }}>{drill.description}</p>}
          {drill.objective && <p style={{ margin: '4px 0' }}><strong>Objective:</strong> {drill.objective}</p>}
          {drill.coaching_points && <p style={{ margin: '4px 0' }}><strong>Coaching points:</strong> {drill.coaching_points}</p>}
          {drill.equipment && <p style={{ margin: '4px 0' }}><strong>Equipment:</strong> {drill.equipment}</p>}
          {(drill.age_min || drill.age_max) && <p style={{ margin: '4px 0' }}><strong>Ages:</strong> {drill.age_min ?? '?'}–{drill.age_max ?? '?'}</p>}
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}

export default function DrillList({ clubId, drills, canManage }: { clubId: string; drills: Drill[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createDrill(clubId, formData)) ?? {},
    initialState
  );
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = filter ? drills.filter((d) => d.category === filter) : drills;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={filter === '' ? 'btn btn-primary' : 'btn'} style={{ fontSize: 12 }} onClick={() => setFilter('')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} className={filter === c.value ? 'btn btn-primary' : 'btn'} style={{ fontSize: 12 }} onClick={() => setFilter(c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No drills yet.</p>}
        {filtered.map((d) => <DrillCard key={d.id} drill={d} canManage={canManage} />)}
      </div>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          {!showForm ? (
            <button className="btn" onClick={() => setShowForm(true)}>+ Add drill</button>
          ) : (
            <form action={formAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: 180, marginBottom: 0 }}>
                  <input name="name" placeholder="Drill name" required />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                  <select name="category" required defaultValue="">
                    <option value="" disabled>Category</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                  <input name="theme" placeholder="Theme (e.g. Passing)" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="description" placeholder="Description" rows={2} />
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="ageMin" type="number" placeholder="Age min" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="ageMax" type="number" placeholder="Age max" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="playerMin" type="number" placeholder="Players min" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="playerMax" type="number" placeholder="Players max" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
                  <input name="durationMinutes" type="number" placeholder="Duration (min)" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                  <select name="difficulty" defaultValue="">
                    <option value="">Difficulty</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input name="equipment" placeholder="Equipment" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input name="objective" placeholder="Objective" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="coachingPoints" placeholder="Coaching points" rows={2} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input name="skills" placeholder="Skills, comma separated (e.g. First Touch, Awareness)" />
              </div>
              {state?.error && <p className="error-text">{state.error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? 'Saving…' : 'Save drill'}
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

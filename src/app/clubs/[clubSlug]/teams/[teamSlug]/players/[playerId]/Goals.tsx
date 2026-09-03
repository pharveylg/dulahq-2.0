'use client';

import { useState, useTransition, useActionState } from 'react';
import { addGoal, updateGoal } from './actions';

type Skill = { id: string; category: string; name: string };
type Goal = {
  id: string;
  title: string;
  description: string | null;
  starting_level: number | null;
  target_level: number | null;
  current_level: number | null;
  start_date: string | null;
  target_date: string | null;
  status: string;
  success_criteria: string | null;
  visibility: string;
  created_at: string;
  development_skills: { name: string } | null;
};

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

const VISIBILITY_OPTIONS = [
  { value: 'coach_only', label: 'Coach only' },
  { value: 'staff', label: 'Club staff' },
  { value: 'player', label: 'Player' },
  { value: 'parent', label: 'Parent' },
  { value: 'player_and_parent', label: 'Player + parent' },
];

const STATUS_OPTIONS = ['not_started', 'in_progress', 'on_track', 'needs_attention', 'achieved', 'archived'];

const STATUS_STYLE: Partial<Record<string, React.CSSProperties>> = {
  achieved: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  needs_attention: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  on_track: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
  archived: { color: 'var(--text-muted)' },
};

function GoalRow({ goal, canManage }: { goal: Goal; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(goal.status);
  const [level, setLevel] = useState(goal.current_level ?? goal.starting_level ?? 1);

  function save(nextStatus: string, nextLevel: number) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('status', nextStatus);
      fd.set('currentLevel', String(nextLevel));
      const result = await updateGoal(goal.id, fd);
      if (result?.error) setError(result.error);
    });
  }

  const progress = goal.starting_level && goal.target_level && goal.target_level !== goal.starting_level
    ? Math.max(0, Math.min(100, Math.round(((level - goal.starting_level) / (goal.target_level - goal.starting_level)) * 100)))
    : null;

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">{goal.title}{goal.development_skills?.name ? ` — ${goal.development_skills.name}` : ''}</div>
          <div className="list-row-meta">
            {goal.target_date ? `Target ${new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No target date'}
            {' · '}visible to: {VISIBILITY_OPTIONS.find((v) => v.value === goal.visibility)?.label}
          </div>
        </div>
        <span className="chip" style={STATUS_STYLE[status]}>{status.replace('_', ' ')}</span>
      </div>
      {progress !== null && (
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
      )}
      {goal.success_criteria && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>{goal.success_criteria}</p>}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={status} disabled={pending} onChange={(e) => { setStatus(e.target.value); save(e.target.value, level); }} style={{ fontSize: 12 }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {goal.target_level && (
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Level
              <input
                type="number" min={1} max={5} value={level} disabled={pending}
                onChange={(e) => { const v = Number(e.target.value); setLevel(v); save(status, v); }}
                style={{ width: 44, fontSize: 12 }}
              />
              / {goal.target_level}
            </label>
          )}
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}

export default function Goals({
  playerId, teamId, clubId, goals, skills, canManage,
}: {
  playerId: string; teamId: string; clubId: string; goals: Goal[]; skills: Skill[]; canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await addGoal(playerId, teamId, clubId, formData)) ?? {},
    initialState
  );
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="card">
        {goals.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No development goals yet.</p>}
        {goals.map((g) => <GoalRow key={g.id} goal={g} canManage={canManage} />)}
      </div>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          {!showForm ? (
            <button className="btn" onClick={() => setShowForm(true)}>+ Add goal</button>
          ) : (
            <form action={formAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input name="title" placeholder="Goal (e.g. Improve weak-foot passing)" required />
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
                  <select name="skillId" defaultValue="">
                    <option value="">Related skill (optional)</option>
                    {skills.map((s) => <option key={s.id} value={s.id}>{s.category} — {s.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="startingLevel" type="number" min={1} max={5} placeholder="Start (1-5)" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="targetLevel" type="number" min={1} max={5} placeholder="Target (1-5)" />
                </div>
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                  <input name="startDate" type="date" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                  <input name="targetDate" type="date" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <select name="visibility" defaultValue="coach_only">
                    {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="successCriteria" placeholder="Success criteria" rows={2} />
              </div>
              {state?.error && <p className="error-text">{state.error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save goal'}</button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

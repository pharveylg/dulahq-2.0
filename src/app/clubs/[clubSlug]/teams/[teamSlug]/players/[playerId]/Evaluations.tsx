'use client';

import { useState, useActionState } from 'react';
import { addEvaluation } from './actions';

type Skill = { id: string; category: string; name: string; sort_order: number };
type Rating = { rating: number; skill: { id: string; name: string; category: string } | null };
type Evaluation = {
  id: string;
  evaluation_date: string;
  period: string | null;
  technical_score: number | null;
  tactical_score: number | null;
  physical_score: number | null;
  mental_score: number | null;
  strengths: string | null;
  development_areas: string | null;
  coach_comments: string | null;
  visibility: string;
  ratings: Rating[];
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

const CATEGORIES = ['technical', 'tactical', 'physical', 'mental'] as const;

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const [expanded, setExpanded] = useState(false);
  const ratingsByCategory = new Map<string, Rating[]>();
  for (const r of evaluation.ratings) {
    if (!r.skill) continue;
    const list = ratingsByCategory.get(r.skill.category) ?? [];
    list.push(r);
    ratingsByCategory.set(r.skill.category, list);
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {new Date(evaluation.evaluation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {evaluation.period ? ` — ${evaluation.period}` : ''}
          </div>
          <div className="list-row-meta">
            {[
              evaluation.technical_score != null && `Technical ${evaluation.technical_score}`,
              evaluation.tactical_score != null && `Tactical ${evaluation.tactical_score}`,
              evaluation.physical_score != null && `Physical ${evaluation.physical_score}`,
              evaluation.mental_score != null && `Mental ${evaluation.mental_score}`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className="chip">{VISIBILITY_OPTIONS.find((v) => v.value === evaluation.visibility)?.label}</span>
      </div>
      {expanded && (
        <div style={{ fontSize: 12.5, paddingLeft: 2 }}>
          {CATEGORIES.map((cat) => {
            const rows = ratingsByCategory.get(cat);
            if (!rows || rows.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 2 }}>{cat}</div>
                {rows.map((r) => (
                  <div key={r.skill!.id} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 260 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.skill!.name}</span>
                    <span>{r.rating}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {evaluation.strengths && <p style={{ margin: '4px 0' }}><strong>Strengths:</strong> {evaluation.strengths}</p>}
          {evaluation.development_areas && <p style={{ margin: '4px 0' }}><strong>Development areas:</strong> {evaluation.development_areas}</p>}
          {evaluation.coach_comments && <p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>{evaluation.coach_comments}</p>}
        </div>
      )}
    </div>
  );
}

export default function Evaluations({
  playerId, teamId, clubId, evaluations, skills, canManage,
}: {
  playerId: string; teamId: string; clubId: string; evaluations: Evaluation[]; skills: Skill[]; canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await addEvaluation(playerId, teamId, clubId, formData)) ?? {},
    initialState
  );
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="card">
        {evaluations.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No evaluations yet.</p>}
        {evaluations.map((e) => <EvaluationCard key={e.id} evaluation={e} />)}
      </div>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          {!showForm ? (
            <button className="btn" onClick={() => setShowForm(true)}>+ Add evaluation</button>
          ) : (
            <form action={formAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                  <input name="evaluationDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                  <input name="period" placeholder="Period (e.g. Fall 2026)" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <select name="visibility" defaultValue="coach_only">
                    {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="technicalScore" type="number" min={1} max={5} step={0.5} placeholder="Technical" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="tacticalScore" type="number" min={1} max={5} step={0.5} placeholder="Tactical" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="physicalScore" type="number" min={1} max={5} step={0.5} placeholder="Physical" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                  <input name="mentalScore" type="number" min={1} max={5} step={0.5} placeholder="Mental" />
                </div>
              </div>

              {CATEGORIES.map((cat) => {
                const catSkills = skills.filter((s) => s.category === cat);
                if (catSkills.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="section-label" style={{ fontSize: 11 }}>{cat}</div>
                    <div className="form-row" style={{ flexWrap: 'wrap' }}>
                      {catSkills.map((s) => (
                        <div key={s.id} className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                          <label style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.name}</label>
                          <select name={`rating_${s.id}`} defaultValue="">
                            <option value="">—</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="strengths" placeholder="Strengths" rows={2} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="developmentAreas" placeholder="Development areas" rows={2} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea name="coachComments" placeholder="Coach comments" rows={2} />
              </div>

              {state?.error && <p className="error-text">{state.error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save evaluation'}</button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

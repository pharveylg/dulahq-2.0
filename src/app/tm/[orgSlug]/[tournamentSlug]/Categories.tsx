'use client';

import { useActionState, useState, useTransition } from 'react';
import { deleteCategory, saveCategory } from './actions';
import { formatMoney } from '@/lib/currency';

export type Category = {
  id: string;
  name: string;
  ageGroup: string | null;
  format: string | null;
  entryFee: number | null;
  capacity: number | null;
  taken: number;
};

type FormState = { error?: string; success?: boolean };

function CategoryForm({ tournamentId, initial, onDone }: { tournamentId: string; initial?: Category; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const result = (await saveCategory(tournamentId, formData)) ?? {};
    if (result.success) onDone?.();
    return result;
  }, {});

  return (
    <form action={action} key={initial?.id ?? 'new'} style={{ display: 'grid', gap: 8 }}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
          <input name="name" placeholder="Name, e.g. U15 Boys" defaultValue={initial?.name} required />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
          <input name="ageGroup" placeholder="Age group" defaultValue={initial?.ageGroup ?? ''} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
          <input name="format" placeholder="Format, e.g. 7-a-side" defaultValue={initial?.format ?? ''} />
        </div>
      </div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
          <input name="entryFee" type="number" min={0} step="0.01" placeholder="Entry fee (PHP)" defaultValue={initial?.entryFee ?? ''} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
          <input name="capacity" type="number" min={1} step={1} placeholder="Capacity (teams)" defaultValue={initial?.capacity ?? ''} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : initial ? 'Save' : 'Add category'}</button>
        {onDone && <button type="button" className="btn" onClick={onDone}>Cancel</button>}
      </div>
      {state?.error && <p className="error-text" style={{ margin: 0 }}>{state.error}</p>}
    </form>
  );
}

function CategoryRow({ tournamentId, category, canManage }: { tournamentId: string; category: Category; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(tournamentId, category.id);
      if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <CategoryForm tournamentId={tournamentId} initial={category} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const full = category.capacity != null && category.taken >= category.capacity;
  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {category.name} {full && <span className="chip" style={{ color: 'var(--warn)' }}>full</span>}
          </div>
          <div className="list-row-meta">
            {[category.ageGroup, category.format].filter(Boolean).join(' · ') || 'No age group or format'} ·{' '}
            {category.entryFee ? formatMoney(category.entryFee, 'PHP') : 'No entry fee'} ·{' '}
            {category.taken}{category.capacity != null ? ` of ${category.capacity}` : ''} {category.taken === 1 && category.capacity == null ? 'entry' : 'entries'}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Edit</button>
            <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={remove}>Delete</button>
          </div>
        )}
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

export default function Categories({ tournamentId, categories, canManage }: { tournamentId: string; categories: Category[]; canManage: boolean }) {
  return (
    <>
      {canManage && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Add a category</div>
          <CategoryForm tournamentId={tournamentId} />
        </div>
      )}
      <div className="card">
        {categories.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No categories yet.{canManage ? ' Add one above so entries can be sorted into divisions.' : ''}
          </p>
        )}
        {categories.map((c) => <CategoryRow key={c.id} tournamentId={tournamentId} category={c} canManage={canManage} />)}
      </div>
    </>
  );
}

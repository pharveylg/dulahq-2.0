type Evaluation = { id: string; evaluation_date: string; created_at: string; period: string | null };
type Goal = { id: string; title: string; created_at: string; status: string };
type Note = { id: string; note: string; created_at: string };

type Entry = { date: string; kind: 'evaluation' | 'goal' | 'note'; label: string };

export default function Timeline({ evaluations, goals, notes }: { evaluations: Evaluation[]; goals: Goal[]; notes: Note[] }) {
  const entries: Entry[] = [
    ...evaluations.map((e) => ({ date: e.created_at, kind: 'evaluation' as const, label: `Evaluation${e.period ? ` — ${e.period}` : ''}` })),
    ...goals.map((g) => ({ date: g.created_at, kind: 'goal' as const, label: `Goal created — ${g.title}` })),
    ...notes.map((n) => ({ date: n.created_at, kind: 'note' as const, label: `Note — “${n.note.slice(0, 60)}${n.note.length > 60 ? '…' : ''}”` })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ICON: Record<Entry['kind'], string> = { evaluation: '📊', goal: '🎯', note: '📝' };

  return (
    <div className="card">
      {entries.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing recorded yet.</p>}
      {entries.slice(0, 25).map((e, i) => (
        <div key={i} className="list-row" style={{ padding: '6px 0' }}>
          <span style={{ fontSize: 13 }}>
            {ICON[e.kind]}{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            {'  '}{e.label}
          </span>
        </div>
      ))}
    </div>
  );
}

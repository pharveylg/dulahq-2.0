'use client';

import { useState, useTransition } from 'react';
import { setAttendance } from './actions';

type Status = 'present' | 'absent' | 'excused' | 'late' | 'no_response';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'no_response', label: 'No response' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
  { value: 'late', label: 'Late' },
];

const STATUS_STYLE: Partial<Record<Status, React.CSSProperties>> = {
  present: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  absent: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  late: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  excused: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

export default function AttendanceRow({
  clubId,
  teamId,
  sessionId,
  playerId,
  playerName,
  initialStatus,
  canManage,
}: {
  clubId: string;
  teamId: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  initialStatus: Status;
  canManage: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: Status) {
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await setAttendance(clubId, teamId, sessionId, playerId, next);
      if (result?.error) {
        setError(result.error);
        setStatus(prev);
      }
    });
  }

  return (
    <div className="list-row" style={{ alignItems: 'center' }}>
      <div className="list-row-main">
        <div className="list-row-title">{playerName}</div>
        {error && <div className="error-text" style={{ marginTop: 2 }}>{error}</div>}
      </div>
      {canManage ? (
        <select
          value={status}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value as Status)}
          style={{ fontSize: 12.5, padding: '5px 8px', ...STATUS_STYLE[status] }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <span className="chip" style={STATUS_STYLE[status]}>{STATUS_OPTIONS.find((o) => o.value === status)?.label}</span>
      )}
    </div>
  );
}

/**
 * Gap analysis P1-12: this exact three-line formula (exclude injured/
 * suspended, count present-or-late, round to a percentage) was written
 * independently three times -- the club-wide dashboard, ActionCenter's
 * per-team snapshots, and the Reports tab's per-team table -- each against
 * its own separately-fetched attendance rows. The queries genuinely differ
 * (different audiences see different team sets, so they can't be merged
 * into one fetch), but the arithmetic has no reason to be copied, and
 * copying it is exactly how the three copies would silently drift from each
 * other the next time one of them gets edited. One function, three callers.
 */
export function computeAttendancePct(rows: { status: string }[]): number | null {
  const eligible = rows.filter((r) => !['injured', 'suspended'].includes(r.status));
  if (eligible.length === 0) return null;
  const attended = eligible.filter((r) => r.status === 'present' || r.status === 'late').length;
  return Math.round((attended / eligible.length) * 100);
}

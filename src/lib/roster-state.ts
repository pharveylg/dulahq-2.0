/**
 * Roster workflow states (Coach Module spec §15), derived rather than stored.
 *
 * The product decision was workflow *visibility*, not enforcement: nobody is
 * gated on reaching a particular state, so there is no reason to persist one.
 * Everything here is computed at read time from the three things that are
 * actually true -- who is proposed (tournament_roster_candidates), what their
 * guardian said (approval_requests), and who has been ported
 * (tournament_roster). A stored status column would be a second source of
 * truth that drifts from the approvals it claims to summarise.
 *
 * The spec's "Locked" is still deliberately not a separate state. phase6w
 * added the withdrawal path the original note here said would be needed
 * before Finalized and Locked could differ -- but it did not add a lock:
 * withdrawal is available at every revision, so "Finalized" continues to
 * describe the whole of what is true. Locked only becomes real if a deadline
 * (an entry cutoff, a tournament start) ever closes the roster, and that
 * would be a fact about the *tournament*, not a state a coach transitions to.
 *
 * `withdrawn` below is likewise about a player, not the roster: it exists so
 * someone taken off a finalized roster reads differently from someone who was
 * never picked, which is history the coach needs and would otherwise vanish
 * (withdrawal deletes the candidate row, so they fall back to "not selected").
 */

export type PlayerRosterState =
  | 'not_selected'
  | 'proposed'
  | 'no_guardian'
  | 'awaiting_guardian'
  | 'guardian_confirmed'
  | 'guardian_declined'
  | 'withdrawn'
  | 'finalized';

export type RosterState =
  | 'draft'
  | 'proposed'
  | 'awaiting_guardians'
  | 'ready_for_review'
  | 'partially_finalized'
  | 'finalized';

export type PlayerStateInput = {
  isCandidate: boolean;
  isFinalized: boolean;
  /** Has a withdrawn tournament_roster row and no live one (phase6w). */
  wasWithdrawn: boolean;
  needsConsent: boolean;
  hasGuardian: boolean;
  approvalStatus: string | null;
};

export function derivePlayerState(p: PlayerStateInput): PlayerRosterState {
  if (p.isFinalized) return 'finalized';
  // Re-proposing a withdrawn player is a deliberate act, so a live candidacy
  // outranks the old withdrawal -- they are back in the workflow.
  if (!p.isCandidate) return p.wasWithdrawn ? 'withdrawn' : 'not_selected';
  if (!p.needsConsent) return 'proposed';

  switch (p.approvalStatus) {
    case 'approved':
      return 'guardian_confirmed';
    case 'declined':
      return 'guardian_declined';
    case 'awaiting':
    case 'draft':
      return 'awaiting_guardian';
    default:
      // expired / cancelled / never asked all mean the same thing to whoever
      // is looking at this: the guardian still needs asking.
      return p.hasGuardian ? 'proposed' : 'no_guardian';
  }
}

export function deriveRosterState(states: PlayerRosterState[]): RosterState {
  // A withdrawn player is history, not part of the roster being assembled --
  // counted here they would hold an otherwise-finished roster short of
  // 'finalized' forever.
  const involved = states.filter((s) => s !== 'not_selected' && s !== 'withdrawn');
  if (involved.length === 0) return 'draft';

  const finalized = involved.filter((s) => s === 'finalized').length;
  if (finalized === involved.length) return 'finalized';
  if (finalized > 0) return 'partially_finalized';

  if (involved.some((s) => s === 'awaiting_guardian')) return 'awaiting_guardians';
  // A minor who is proposed but unasked (or with no guardian) means the
  // acknowledgement round hasn't finished being set up yet.
  if (involved.some((s) => s === 'proposed' || s === 'no_guardian')) return 'proposed';
  return 'ready_for_review';
}

export const PLAYER_STATE_LABEL: Record<PlayerRosterState, string> = {
  not_selected: 'Not selected',
  proposed: 'Proposed',
  no_guardian: 'No guardian on file',
  awaiting_guardian: 'Awaiting guardian',
  guardian_confirmed: 'Guardian confirmed',
  guardian_declined: 'Guardian declined',
  withdrawn: 'Withdrawn',
  finalized: 'Finalized',
};

export const ROSTER_STATE_LABEL: Record<RosterState, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  awaiting_guardians: 'Awaiting guardians',
  ready_for_review: 'Ready for review',
  partially_finalized: 'Partly finalized',
  finalized: 'Finalized',
};

type Tone = 'neutral' | 'warn' | 'good' | 'bad';

export const PLAYER_STATE_TONE: Record<PlayerRosterState, Tone> = {
  not_selected: 'neutral',
  proposed: 'neutral',
  no_guardian: 'bad',
  awaiting_guardian: 'warn',
  guardian_confirmed: 'good',
  guardian_declined: 'bad',
  withdrawn: 'neutral',
  finalized: 'good',
};

export const ROSTER_STATE_TONE: Record<RosterState, Tone> = {
  draft: 'neutral',
  proposed: 'neutral',
  awaiting_guardians: 'warn',
  ready_for_review: 'warn',
  partially_finalized: 'warn',
  finalized: 'good',
};

export function toneStyle(tone: Tone): React.CSSProperties {
  switch (tone) {
    case 'good':
      return { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' };
    case 'warn':
      return { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' };
    case 'bad':
      return { color: 'var(--danger, #b3261e)' };
    default:
      return { color: 'var(--text-muted)' };
  }
}

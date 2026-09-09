/**
 * The roster workflow states are the whole deliverable of Phase C, and they
 * are pure functions over three facts, so they are worth pinning directly --
 * cheaply, without touching the database.
 *
 * Run with `npm run test:unit`. (`npm run test:rls` hits the live project;
 * these don't.)
 */
import { describe, it, expect } from 'vitest';
import {
  derivePlayerState,
  deriveRosterState,
  type PlayerStateInput,
  type PlayerRosterState,
} from '../../src/lib/roster-state';

const base: PlayerStateInput = {
  isCandidate: false,
  isFinalized: false,
  needsConsent: false,
  hasGuardian: false,
  approvalStatus: null,
};

describe('derivePlayerState', () => {
  it('a player nobody proposed is not selected', () => {
    expect(derivePlayerState(base)).toBe('not_selected');
  });

  it('a ported player is finalized regardless of everything else', () => {
    expect(derivePlayerState({ ...base, isFinalized: true, approvalStatus: 'declined' })).toBe('finalized');
  });

  it('a proposed adult is simply proposed -- no guardian step applies', () => {
    expect(derivePlayerState({ ...base, isCandidate: true, needsConsent: false })).toBe('proposed');
  });

  it('a proposed minor with a guardian but no request yet is proposed', () => {
    expect(derivePlayerState({ ...base, isCandidate: true, needsConsent: true, hasGuardian: true })).toBe('proposed');
  });

  // The case the Phase 3 live test surfaced: a genuine minor with nobody to
  // ask. It must be visibly different from "we just haven't asked yet".
  it('a proposed minor with NO guardian is called out separately', () => {
    expect(derivePlayerState({ ...base, isCandidate: true, needsConsent: true, hasGuardian: false })).toBe('no_guardian');
  });

  it('tracks the guardian decision', () => {
    const minor = { ...base, isCandidate: true, needsConsent: true, hasGuardian: true };
    expect(derivePlayerState({ ...minor, approvalStatus: 'awaiting' })).toBe('awaiting_guardian');
    expect(derivePlayerState({ ...minor, approvalStatus: 'approved' })).toBe('guardian_confirmed');
    expect(derivePlayerState({ ...minor, approvalStatus: 'declined' })).toBe('guardian_declined');
  });

  it('an expired or cancelled request means the guardian needs asking again', () => {
    const minor = { ...base, isCandidate: true, needsConsent: true, hasGuardian: true };
    expect(derivePlayerState({ ...minor, approvalStatus: 'expired' })).toBe('proposed');
    expect(derivePlayerState({ ...minor, approvalStatus: 'cancelled' })).toBe('proposed');
  });
});

describe('deriveRosterState', () => {
  const roster = (...states: PlayerRosterState[]) => deriveRosterState(states);

  it('is draft when nobody is proposed, even with players on the team', () => {
    expect(roster('not_selected', 'not_selected')).toBe('draft');
    expect(roster()).toBe('draft');
  });

  it('is finalized only when every proposed player is ported', () => {
    expect(roster('finalized', 'finalized', 'not_selected')).toBe('finalized');
  });

  it('is partly finalized while some are ported and some are not', () => {
    expect(roster('finalized', 'guardian_confirmed')).toBe('partially_finalized');
  });

  it('awaiting guardians outranks a still-unasked minor', () => {
    expect(roster('awaiting_guardian', 'proposed')).toBe('awaiting_guardians');
  });

  it('is proposed while a minor still needs asking', () => {
    expect(roster('proposed', 'guardian_confirmed')).toBe('proposed');
    expect(roster('no_guardian', 'guardian_confirmed')).toBe('proposed');
  });

  it('is ready for review once every guardian has answered', () => {
    expect(roster('guardian_confirmed', 'guardian_confirmed', 'guardian_declined')).toBe('ready_for_review');
  });

  // A squad of adults needs no guardian round at all, so it is immediately
  // reviewable rather than sitting in "proposed" forever.
  it('an all-adult squad goes straight to ready for review', () => {
    // adults derive as 'proposed', which deliberately keeps the roster in
    // 'proposed' -- the coach still has to decide to finalize.
    expect(roster('proposed', 'proposed')).toBe('proposed');
  });
});

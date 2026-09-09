// The type -> category mapping matters beyond labeling: phase6j's RLS reads
// the row's own `category` column to decide staff visibility (medical is
// visible to view_medical staff -- coach/team_manager/club_admin -- every
// other category stays manage_documents-only), so this map and the one
// baked into that migration's CASE expression must stay in sync.
export const TYPE_CATEGORY: Record<string, string> = {
  birth_certificate: 'identity',
  government_id: 'identity',
  medical_clearance: 'medical',
  allergy_disclosure: 'medical',
  insurance_card: 'medical',
  registration: 'registration',
  code_of_conduct: 'consent',
  consent_form: 'consent',
  media_consent: 'consent',
  tournament_waiver: 'consent',
  club_policy: 'other',
  other: 'other',
};

export const MEDICAL_TYPES = Object.keys(TYPE_CATEGORY).filter((t) => TYPE_CATEGORY[t] === 'medical');

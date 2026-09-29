-- Application-flow audit (2026-09-29), cleanup step 8. approval_is_granted()
-- (phase4_approvals_and_notifications) was hardened against anon access in
-- phase6s as a "minors-data oracle" -- but git history shows src/lib/
-- roster-state.ts's inline status check (introduced 2026-09-08 19:06, an
-- hour BEFORE phase6s's 20:21 hardening) already superseded it the same day
-- it was written. Verified zero references anywhere: no policy, no other
-- SQL function, no app code, no test. The phase6s lockdown was a blanket
-- security sweep, not evidence of an active caller.
drop function if exists public.approval_is_granted(text, uuid);

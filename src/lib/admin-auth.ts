import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { generateTempPassword } from './temp-password';

/**
 * The ONE place the service-role key is used by the app (previously only the RLS test
 * suite used it). It bypasses every RLS policy, so:
 *
 *  - Import this only from server actions ('use server' files) and route handlers,
 *    never from a component. Nothing here is re-exported to the client.
 *  - Every caller must have authorized the user FIRST, through a database function
 *    (can_provision_login / can_reissue_login), before touching this client. Those
 *    functions are the authority; this module only performs what they allowed.
 *  - The key must never be prefixed NEXT_PUBLIC_ or logged.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in the environment (Vercel project settings for
 * production, .env.local locally).
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) {
    throw new Error('Creating logins isn’t set up on this server: SUPABASE_SERVICE_ROLE_KEY is missing.');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function newTempPassword() {
  return generateTempPassword(randomInt);
}

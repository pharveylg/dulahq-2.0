import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { generateTempPassword } from './temp-password';

/**
 * The server-only factory for the service-role client. It bypasses every RLS policy,
 * so:
 *
 *  - Import this only from server actions, route handlers, or other modules guarded by
 *    `server-only`; never from a component. Nothing here is re-exported to the client.
 *  - Login provisioning must pass its database authorization RPC before using it.
 *    Notification writes must derive recipients from authorized domain actions, verify
 *    recipient scope, and push only from a persisted notification ID.
 *  - The key must never be prefixed NEXT_PUBLIC_ or logged.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local locally and a
 * separately authorized production configuration for deployment).
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

import 'server-only';
import { headers } from 'next/headers';

/**
 * The origin this request actually arrived on, derived from the Host/
 * X-Forwarded-Proto headers rather than a separate env var -- works unchanged
 * in local dev, a Vercel preview deployment, and production, with nothing new
 * to keep in sync. Falls back to the production domain only if headers() is
 * somehow unavailable (shouldn't happen from a server action or route handler).
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host');
  if (!host) return 'https://dulahq.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env reader.
 *
 * The RLS suite needs SUPABASE_URL, SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY, none of which carry a VITE_ prefix, and Next.js
 * loads .env.local itself at runtime so nothing else in this repo does it.
 *
 * Parsed by hand rather than via vite's loadEnv: loadEnv lives in `vite`, not
 * `vitest/config`, and this avoids depending on which package re-exports it.
 * Splitting on /\r?\n/ matters here — these files are CRLF on Windows.
 */
function readEnvFile(file: string): Record<string, string> {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return {};

  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);

    out[match[1]] = value;
  }
  return out;
}

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    // beforeAll makes many sequential round trips (fixture inserts, 5x
    // createUser, 5x signInWithPassword) against the live remote project --
    // the default 10s hook timeout isn't enough headroom.
    hookTimeout: 30000,
    // .env.local wins over .env, matching Next.js precedence.
    env: { ...readEnvFile('.env'), ...readEnvFile('.env.local') },
  },
});

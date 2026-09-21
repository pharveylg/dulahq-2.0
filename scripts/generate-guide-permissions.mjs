// Refreshes the permission tables in docs/guides from the live permission
// catalog (permissions, role_permission_defaults, guardian_permission_defaults).
//
//   npm run docs:permissions          rewrite any table that is out of date
//   npm run docs:permissions:check    change nothing; exit 1 if any table is stale
//
// The rendering lives in scripts/lib/guide-permissions.mjs (unit-tested, and
// also used by the RLS suite's drift test).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyBlocks } from './lib/guide-permissions.mjs';

const GUIDES_DIR = 'docs/guides';
const check = process.argv.includes('--check');

for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  const catalog = {
    permissions: await must(admin.from('permissions').select('key, scope, label, description'), 'read permissions'),
    roleDefaults: await must(admin.from('role_permission_defaults').select('role, permission_key'), 'read role defaults'),
    guardianDefaults: await must(admin.from('guardian_permission_defaults').select('permission_key'), 'read guardian defaults'),
  };

  const files = readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.md')).sort();
  const stale = [];
  let blockCount = 0;

  for (const file of files) {
    const path = join(GUIDES_DIR, file);
    const original = readFileSync(path, 'utf-8');
    const { text, changed, blocks } = applyBlocks(original, catalog);
    blockCount += blocks;
    if (blocks > 0) console.log(`${file}: ${blocks} table${blocks === 1 ? '' : 's'}${changed ? (check ? ' — STALE' : ' — updated') : ' — up to date'}`);
    if (changed) {
      stale.push(file);
      if (!check) writeFileSync(path, text);
    }
  }

  console.log(`${blockCount} generated table${blockCount === 1 ? '' : 's'} across ${files.length} file${files.length === 1 ? '' : 's'}.`);
  if (check && stale.length > 0) {
    console.error(`Out of date: ${stale.join(', ')}. Run "npm run docs:permissions".`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('DOCS PERMISSIONS FAILED:', err.message);
  process.exit(1);
});

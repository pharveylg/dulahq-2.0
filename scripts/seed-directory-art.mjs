// Generates and uploads the images the public directory shows for the showcase
// data: one crest per club (stored in R2, referenced from clubs.branding) and
// one poster per tournament (stored in the public tournament-posters bucket,
// referenced from tournaments.poster_url).
//
// The crests are drawn by src/lib/crest.ts -- the same module the app uses for
// its on-the-fly fallback -- so a seeded logo and a generated fallback look like
// the same product. Rendering is sharp (already a dependency of Next) so there
// is nothing new to install.
//
// Safe to re-run:
//   * only touches the four showcase orgs, never a real tenant;
//   * skips anything that already has an image, so it can't overwrite a logo or
//     poster someone uploaded. Pass --force to replace the seeded ones anyway
//     (the previous R2 object is deleted so nothing is orphaned).
//
//   node scripts/seed-directory-art.mjs                  seed what is missing
//   node scripts/seed-directory-art.mjs --force          re-render everything
//   node scripts/seed-directory-art.mjs --preview <dir>  write PNGs to <dir>,
//                                                        upload nothing
//
// seed-showcase-demo.mjs runs this at the end, so a full re-seed keeps the art.
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crestSpec, crestSvg, safeAccent, darkenHex } from '../src/lib/crest.ts';

const SHOWCASE_ORGS = ['usna-gali', 'cdo-ysc', 'pilipinas-futbol', 'davao-unity-sports'];
const POSTER_BUCKET = 'tournament-posters';

const args = process.argv.slice(2);
const force = args.includes('--force');
const previewIdx = args.indexOf('--preview');
const previewDir = previewIdx >= 0 ? args[previewIdx + 1] : null;
if (previewIdx >= 0 && !previewDir) throw new Error('--preview needs a directory');

for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// r2.ts reads its bucket name from the environment when it is imported, so it
// has to be imported after the variables above are in place.
const r2 = previewDir ? null : await import('../shared/files/lib/r2.ts');

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(what + ': ' + error.message);
  return data;
}

const xmlEscape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** Greedy word wrap on character count; enough for a poster title, no font metrics needed. */
function wrap(text, maxChars, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

async function renderClubLogo(club, org) {
  const spec = crestSpec({ name: club.name, seed: club.slug, accent: org.accent, kind: 'club' });
  return sharp(Buffer.from(crestSvg(512, spec))).png().toBuffer();
}

async function renderPoster(t, org) {
  const accent = safeAccent(org.accent);
  const spec = crestSpec({ name: t.name, seed: org.slug + '/' + t.slug, accent, kind: 'tournament', primary: accent });
  const ground = darkenHex(accent, 0.55);
  // Nested <svg> places the crest; its own xmlns is harmless inside the parent.
  const crest = crestSvg(300, spec).replace('<svg ', '<svg x="150" y="170" ');
  const font = "font-family=\"Oswald, 'Arial Narrow', Arial, Helvetica, sans-serif\" font-weight=\"700\"";
  const title = wrap(t.name.toUpperCase(), 13, 3);
  const titleSvg = title
    .map((ln, i) => '<text x="300" y="' + (600 + i * 64) + '" text-anchor="middle" ' + font + ' font-size="58" fill="#FFFFFF">' + xmlEscape(ln) + '</text>')
    .join('');
  const afterTitle = 600 + (title.length - 1) * 64 + 52;
  const date = formatDate(t.event_date);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">' +
    '<rect width="600" height="900" fill="' + ground + '"/>' +
    '<rect x="22" y="22" width="556" height="856" fill="none" stroke="' + spec.secondary + '" stroke-width="3"/>' +
    (date ? '<text x="52" y="84" ' + font + ' font-size="30" letter-spacing="3" fill="' + spec.secondary + '">' + xmlEscape(date) + '</text>' : '') +
    crest +
    titleSvg +
    '<text x="300" y="' + afterTitle + '" text-anchor="middle" ' + font + ' font-size="28" fill="#E2E8F0">' + xmlEscape(org.name) + '</text>' +
    (t.venue ? '<text x="300" y="' + (afterTitle + 44) + '" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#CBD5E1">' + xmlEscape(t.venue) + '</text>' : '') +
    '</svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const orgs = await must(admin.from('organizations').select('id, slug, name, accent').in('slug', SHOWCASE_ORGS), 'select orgs');
  if (orgs.length === 0) {
    console.log('No showcase orgs found -- run seed-showcase-demo.mjs first.');
    return;
  }
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  if (previewDir) mkdirSync(previewDir, { recursive: true });

  const clubs = await must(admin.from('clubs').select('id, slug, name, org_id, branding').in('org_id', [...orgById.keys()]).order('slug'), 'select clubs');
  for (const club of clubs) {
    const org = orgById.get(club.org_id);
    const existingKey = club.branding && typeof club.branding === 'object' ? club.branding.logoKey : null;
    if (existingKey && !force) {
      console.log('club  ' + club.slug + ': already has a logo, skipped');
      continue;
    }
    const png = await renderClubLogo(club, org);
    if (previewDir) {
      writeFileSync(join(previewDir, 'club-' + club.slug + '.png'), png);
      console.log('club  ' + club.slug + ': previewed');
      continue;
    }
    const { key } = await r2.uploadFile({ tenantId: club.id, category: 'branding', fileName: club.slug + '-crest.png', body: png, contentType: 'image/png' });
    await must(admin.from('clubs').update({ branding: { ...(club.branding && typeof club.branding === 'object' ? club.branding : {}), logoKey: key } }).eq('id', club.id), 'update club ' + club.slug);
    // Only delete the old object once the row points at the new one.
    if (existingKey) await r2.deleteFile(existingKey).catch(() => {});
    console.log('club  ' + club.slug + ': logo uploaded');
  }

  const tournaments = await must(
    admin.from('tournaments').select('id, slug, name, org_id, poster_url, event_date, venue').in('org_id', [...orgById.keys()]).order('slug'),
    'select tournaments'
  );
  for (const t of tournaments) {
    const org = orgById.get(t.org_id);
    const label = 'tournament ' + org.slug + '/' + t.slug;
    if (t.poster_url && String(t.poster_url).trim() && !force) {
      console.log(label + ': already has a poster, skipped');
      continue;
    }
    const png = await renderPoster(t, org);
    if (previewDir) {
      writeFileSync(join(previewDir, 'poster-' + org.slug + '-' + t.slug + '.png'), png);
      console.log(label + ': previewed');
      continue;
    }
    const path = org.slug + '/' + t.slug + '-poster.png';
    const { error: upErr } = await admin.storage.from(POSTER_BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error('upload ' + path + ': ' + upErr.message);
    const { data: pub } = admin.storage.from(POSTER_BUCKET).getPublicUrl(path);
    // upsert reuses the same URL, so a re-render needs a new query string or
    // browsers and CDNs keep serving the old image.
    const url = pub.publicUrl + '?v=' + Date.now().toString(36);
    await must(admin.from('tournaments').update({ poster_url: url }).eq('id', t.id), 'update tournament ' + t.slug);
    console.log(label + ': poster uploaded');
  }
}

main().catch((err) => {
  console.error('SEED ART FAILED:', err.message);
  process.exit(1);
});

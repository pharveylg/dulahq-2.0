// Wipes every existing demo/test org (dulahq-rbac-demo, dula-demo, damilagsc,
// agusan-yd -- all ad-hoc data from earlier provisioning experiments, none of
// it matching any real tenant) and replaces it with one coherent showcase
// dataset: four Philippine football orgs exercising every entitlement
// combination (club+tournament, club-only, tournament-only x2), full club
// rosters with guardians and staff, and multi-entry tournament categories
// with officials.
//
// Real auth accounts (service-role signups, shared password below) are only
// created for people who need to actually sign in and operate the app --
// org admins, club admins, coaches, team managers, staff. Players and
// guardians are data rows only (players.user_id / guardians.user_id are
// nullable), matching how the app itself only requires a login for staff.
//
// Deliberately leaves gadzonline@gmail.com and akela.gtg@gmail.com (the real
// admin emails on the damilagsc/agusan-yd test orgs) untouched -- their
// org_members rows disappear with those orgs, but the auth identities are
// real people's accounts, not synthetic demo data, so this script never
// calls deleteUser on them.
//
// Re-runnable: wipes its own prior run (by org slug and by the
// @dulahq-showcase.local email domain) before reseeding.
//
// Writes docs/demo-data-showcase.md summarizing everything it created --
// generated from the same data this script seeds, so the doc can't drift
// from the database.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = 'DemoPass2026!';
const EMAIL_DOMAIN = 'dulahq-showcase.local';
const OLD_SLUGS = [
  'dulahq-rbac-demo', 'dula-demo', 'damilagsc', 'agusan-yd',
  // also wipe this script's own org slugs first, so re-running after a
  // partial/failed run (or just to reset the dataset) is always safe.
  'usna-gali', 'cdo-ysc', 'pilipinas-futbol', 'davao-unity-sports',
];
const OLD_DEMO_EMAILS = [
  'demo-platformadmin@dulahq-demo.local', 'demo-orgadmin@dulahq-demo.local', 'demo-clubadmin@dulahq-demo.local',
  'demo-coach@dulahq-demo.local', 'demo-teammanager@dulahq-demo.local', 'demo-staff@dulahq-demo.local',
  'demo-guardian@dulahq-demo.local', 'demo-player@dulahq-demo.local',
];

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// ---------- name / attribute generators ----------
const FIRST_M = ['Jose', 'Juan', 'Antonio', 'Ramon', 'Miguel', 'Ferdinand', 'Rodrigo', 'Benigno', 'Manuel', 'Andres', 'Emilio', 'Gregorio', 'Leandro', 'Ariel', 'Benjie', 'Ferdie', 'Noel', 'Ronnel', 'Jomar', 'Kim', 'Mark', 'Paolo', 'Carlo', 'Enzo', 'Rafael', 'Gabriel', 'Diego', 'Marcus', 'Elias', 'Teodoro'];
const FIRST_F = ['Maria', 'Isabela', 'Carmela', 'Fe', 'Grace', 'Corazon', 'Imelda', 'Josefa', 'Luisa', 'Remedios', 'Rosario', 'Trinidad', 'Angelica', 'Bianca', 'Camille', 'Diane', 'Erika', 'Faith', 'Gemma', 'Hazel', 'Irene', 'Jasmine', 'Kristine', 'Liza', 'Mylene', 'Nerissa', 'Precious', 'Queenie', 'Rowena', 'Shiela'];
const LAST = ['Cruz', 'Santos', 'Reyes', 'Bautista', 'Villanueva', 'Garcia', 'Torres', 'Mendoza', 'Dela Cruz', 'Ramos', 'Aquino', 'Flores', 'Rivera', 'Diaz', 'Castillo', 'Gonzales', 'Domingo', 'Fernandez', 'Pascual', 'Salazar', 'Ocampo', 'Navarro', 'Ignacio', 'Alvarado', 'Dagohoy', 'Kintanar', 'Owades', 'Villar', 'Abad', 'Manalo', 'Villaflor', 'Bendijo', 'Sarmiento', 'Estrada', 'Gatchalian', 'Marcelo', 'Padilla', 'Bacani', 'Uy', 'Tan'];
let nameSeq = 0;
function personName(gender = 'M') {
  const pool = gender === 'F' ? FIRST_F : FIRST_M;
  const first = pool[nameSeq % pool.length];
  const last = LAST[Math.floor(nameSeq * 1.7 + 3) % LAST.length];
  nameSeq++;
  return `${first} ${last}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function dob(minAge, maxAge, i) {
  const age = minAge + (i % (maxAge - minAge + 1));
  const year = 2026 - age;
  const month = 1 + ((i * 3) % 12);
  const day = 1 + ((i * 5) % 27);
  return `${year}-${pad(month)}-${pad(day)}`;
}
const OUTFIELD = ['RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'ST'];
function positionFor(i) { return i < 2 ? 'GK' : OUTFIELD[(i - 2) % OUTFIELD.length]; }
function footFor(i) { return i % 3 === 0 ? 'left' : i % 3 === 1 ? 'right' : 'both'; }

// ---------- wipe ----------
async function wipe() {
  console.log('Wiping prior showcase/demo orgs...');
  const oldOrgs = await must(admin.from('organizations').select('id,slug').in('slug', OLD_SLUGS), 'select old orgs');
  const oldOrgIds = oldOrgs.map((o) => o.id);
  let orphanTournamentIds = [];
  if (oldOrgIds.length) {
    // tournament_categories/entries/roster/officials/members all cascade on
    // organizations delete (their own org_id FK), but tournaments.org_id
    // itself is ON DELETE SET NULL -- so the tournament row survives the org
    // delete as an orphan, and can only be deleted *after*, once nothing
    // (tournament_categories etc, gone in the same delete) still references
    // its id. Deleting tournaments first, before the org, fails instead --
    // their children still reference them at that point.
    const oldTournaments = await must(admin.from('tournaments').select('id').in('org_id', oldOrgIds), 'select old tournaments');
    orphanTournamentIds = oldTournaments.map((t) => t.id);
    await must(admin.from('organizations').delete().in('id', oldOrgIds), 'delete old orgs');
  }
  if (orphanTournamentIds.length) {
    await must(admin.from('tournaments').delete().in('id', orphanTournamentIds), 'delete orphaned tournaments');
  }
  await admin.from('platform_admins').delete().eq('email', 'demo-platformadmin@dulahq-demo.local');
  await admin.from('platform_admins').delete().eq('email', `demo-platformadmin@${EMAIL_DOMAIN}`);

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users.users) {
    if (OLD_DEMO_EMAILS.includes(u.email) || (u.email && u.email.endsWith('@' + EMAIL_DOMAIN))) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

// ---------- people ----------
async function createPerson(email, name) {
  const user = await must(admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }), `createUser ${email}`);
  await must(admin.from('users').update({ name }).eq('id', user.user.id).select().single(), `set name ${email}`);
  return user.user.id;
}

// ---------- tenants ----------
async function createOrg(slug, name, accent, products) {
  const org = await must(admin.from('organizations').insert({ slug, name, accent, status: 'active' }).select().single(), `org ${slug}`);
  await must(admin.from('org_entitlements').insert(products.map((product) => ({ org_id: org.id, product }))), `entitlements ${slug}`);
  return org;
}
async function addOrgAdmin(org, email, name) {
  const uid = await createPerson(email, name);
  await must(admin.from('org_members').insert({ org_id: org.id, email, user_id: uid, role: 'admin' }), `org_members ${email}`);
  return { id: uid, email, name };
}
async function createClub(org, footballId, slug, name, location, about) {
  return must(
    admin.from('clubs').insert({ org_id: org.id, slug, name, sport_id: footballId, publicly_listed: true, location, about }).select().single(),
    `club ${slug}`
  );
}
async function seedClubAdmin(org, club, clubSlug) {
  const name = personName('M');
  const email = `clubadmin.${clubSlug}@${EMAIL_DOMAIN}`;
  const id = await createPerson(email, name);
  await must(admin.from('club_staff').insert({ club_id: club.id, org_id: org.id, user_id: id, role: 'club_admin' }), `club_admin ${clubSlug}`);
  return { id, email, name };
}
async function createTeam(org, club, slug, name, squadType) {
  return must(
    admin.from('teams').insert({ org_id: org.id, club_id: club.id, slug, name, squad_type: squadType }).select().single(),
    `team ${slug}`
  );
}
async function seedPlayers(org, club, team, { count, gender, minAge, maxAge }) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      org_id: org.id, club_id: club.id, team_id: team.id,
      name: personName(gender), jersey: String(i + 1), position: positionFor(i),
      dob: dob(minAge, maxAge, i), preferred_foot: footFor(i), development_status: 'on_track',
    });
  }
  return must(admin.from('players').insert(rows).select(), `players ${team.slug}`);
}
async function seedGuardians(org, players) {
  const guardianRows = players.map((p, i) => ({
    org_id: org.id,
    name: personName(i % 2 === 0 ? 'F' : 'M'),
    account_status: 'no_account',
    contact_info: { phone: `+63917${String(1000000 + i).padStart(7, '0')}` },
  }));
  const guardians = await must(admin.from('guardians').insert(guardianRows).select(), 'guardians');
  const links = guardians.map((g, i) => ({
    org_id: org.id, player_id: players[i].id, guardian_id: g.id,
    relationship: 'parent', is_primary_contact: true, payment_responsible: true,
  }));
  await must(admin.from('player_guardians').insert(links), 'player_guardians');
  return guardians;
}
async function seedTeamStaff(org, club, team, teamSlugForEmail) {
  const coach = { name: personName('M'), email: `coach.${teamSlugForEmail}@${EMAIL_DOMAIN}` };
  const tm = { name: personName('M'), email: `teammanager.${teamSlugForEmail}@${EMAIL_DOMAIN}` };
  const staff = { name: personName('F'), email: `staff.${teamSlugForEmail}@${EMAIL_DOMAIN}` };
  coach.id = await createPerson(coach.email, coach.name);
  tm.id = await createPerson(tm.email, tm.name);
  staff.id = await createPerson(staff.email, staff.name);
  await must(
    admin.from('club_staff').insert([
      { club_id: club.id, org_id: org.id, user_id: coach.id, role: 'coach' },
      { club_id: club.id, org_id: org.id, user_id: tm.id, role: 'team_manager' },
      { club_id: club.id, org_id: org.id, user_id: staff.id, role: 'staff' },
    ]),
    `club_staff ${teamSlugForEmail}`
  );
  await must(
    admin.from('user_assigned_teams').insert([
      { user_id: coach.id, team_id: team.id, org_id: org.id },
      { user_id: tm.id, team_id: team.id, org_id: org.id },
    ]),
    `assign teams ${teamSlugForEmail}`
  );
  return { coach, teamManager: tm, staff };
}

// ---------- tournaments ----------
async function createTournament(org, footballId, slug, name, venue, eventDate) {
  return must(
    admin.from('tournaments').insert({
      org_id: org.id, slug, name, venue, event_date: eventDate, sport_id: footballId,
      publicly_listed: true, guest_access_enabled: true,
    }).select().single(),
    `tournament ${slug}`
  );
}
async function createCategory(org, tournament, name, ageGroup, minBY, maxBY, format) {
  return must(
    admin.from('tournament_categories').insert({
      org_id: org.id, tournament_id: tournament.id, name, age_group: ageGroup,
      min_birth_year: minBY ?? null, max_birth_year: maxBY ?? null, format, sort_order: 0,
    }).select().single(),
    `category ${name}`
  );
}
async function addEntry(org, tournament, category, { teamName, entrantOrgId = null, clubId = null, teamId = null }) {
  return must(
    admin.from('tournament_entries').insert({
      tournament_id: tournament.id, category_id: category.id, host_org_id: org.id,
      entrant_org_id: entrantOrgId, club_id: clubId, team_id: teamId, team_name: teamName, status: 'accepted',
    }).select().single(),
    `entry ${teamName}`
  );
}
async function addRosterFromPlayers(org, tournament, entry, players) {
  const rows = players.map((p) => ({
    org_id: org.id, tournament_id: tournament.id, entry_id: entry.id, full_name: p.name, dob: p.dob,
    jersey: p.jersey, position: p.position, player_id: p.id, source_org_id: org.id, consent_on_file: true, status: 'approved',
  }));
  return must(admin.from('tournament_roster').insert(rows), `roster ${entry.team_name}`);
}
async function addFictionalRoster(org, tournament, entry, count, gender, minAge, maxAge) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      org_id: org.id, tournament_id: tournament.id, entry_id: entry.id, full_name: personName(gender),
      dob: dob(minAge, maxAge, i), jersey: String(i + 1), position: positionFor(i), consent_on_file: true, status: 'approved',
    });
  }
  return must(admin.from('tournament_roster').insert(rows), `roster ${entry.team_name}`);
}
async function seedOfficials(org, count, prefix) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      org_id: org.id, full_name: personName('M'), designation: i === 0 ? 'Head Referee' : 'Referee',
      phone: `+63918${String(2000000 + i).padStart(7, '0')}`, email: `${prefix}.official${i + 1}@${EMAIL_DOMAIN}`, active: true,
    });
  }
  return must(admin.from('org_officials').insert(rows).select(), `officials ${prefix}`);
}
async function assignOfficials(org, tournament, officials, roles) {
  const rows = officials.map((o, i) => ({ org_id: org.id, tournament_id: tournament.id, official_id: o.id, role: roles[i % roles.length] }));
  return must(admin.from('tournament_officials').insert(rows), `assign officials ${tournament.slug}`);
}

async function main() {
  await wipe();

  const { id: footballId } = await must(admin.from('sports').select('id').eq('key', 'football').single(), 'sports lookup');

  const report = { orgs: [] };

  // ============================================================
  // Usna Gali -- club + tournament
  // ============================================================
  console.log('Seeding Usna Gali...');
  const usnaGali = await createOrg('usna-gali', 'Usna Gali', '#059669', ['club', 'tournament']);
  const usnaGaliAdmin = await addOrgAdmin(usnaGali, `orgadmin.usna-gali@${EMAIL_DOMAIN}`, personName('M'));
  const orgReport = { name: 'Usna Gali', slug: 'usna-gali', orgAdmin: usnaGaliAdmin, clubs: [], tournaments: [] };

  const usnaGaliFC = await createClub(usnaGali, footballId, 'usna-gali-fc', 'Usna Gali FC', 'Malaybalay City, Bukidnon', 'Grassroots football club running youth squads out of Malaybalay.');
  const usnaGaliFCAdmin = await seedClubAdmin(usnaGali, usnaGaliFC, 'usna-gali-fc');
  const clubReport1 = { name: usnaGaliFC.name, slug: usnaGaliFC.slug, admin: usnaGaliFCAdmin, teams: [] };

  const u8 = await createTeam(usnaGali, usnaGaliFC, 'u8', 'U8', 'grassroots');
  const u8Players = await seedPlayers(usnaGali, usnaGaliFC, u8, { count: 10, gender: 'M', minAge: 6, maxAge: 8 });
  clubReport1.teams.push({ name: 'U8', slug: 'u8', players: u8Players.length, guardians: 0, staff: null });

  const u15g = await createTeam(usnaGali, usnaGaliFC, 'u15-girls', 'U15 Girls', 'grassroots');
  const u15gPlayers = await seedPlayers(usnaGali, usnaGaliFC, u15g, { count: 12, gender: 'F', minAge: 13, maxAge: 15 });
  const u15gGuardians = await seedGuardians(usnaGali, u15gPlayers);
  const u15gStaff = await seedTeamStaff(usnaGali, usnaGaliFC, u15g, 'u15-girls.usna-gali-fc');
  clubReport1.teams.push({ name: 'U15 Girls', slug: 'u15-girls', players: u15gPlayers.length, guardians: u15gPlayers.length, staff: u15gStaff });

  const u15b = await createTeam(usnaGali, usnaGaliFC, 'u15-boys', 'U15 Boys', 'grassroots');
  const u15bPlayers = await seedPlayers(usnaGali, usnaGaliFC, u15b, { count: 12, gender: 'M', minAge: 13, maxAge: 15 });
  await seedGuardians(usnaGali, u15bPlayers);
  const u15bStaff = await seedTeamStaff(usnaGali, usnaGaliFC, u15b, 'u15-boys.usna-gali-fc');
  clubReport1.teams.push({ name: 'U15 Boys', slug: 'u15-boys', players: u15bPlayers.length, guardians: u15bPlayers.length, staff: u15bStaff });

  orgReport.clubs.push(clubReport1);

  const unsaGaliFC = await createClub(usnaGali, footballId, 'unsa-gali-fc', 'Unsa Gali FC', 'Valencia City, Bukidnon', 'Adult amateur football club fielding open and masters squads.');
  const unsaGaliFCAdmin = await seedClubAdmin(usnaGali, unsaGaliFC, 'unsa-gali-fc');
  const clubReport2 = { name: unsaGaliFC.name, slug: unsaGaliFC.slug, admin: unsaGaliFCAdmin, teams: [] };

  const mensOpen1 = await createTeam(usnaGali, unsaGaliFC, 'mens-open', 'Mens Open', 'adult');
  const mensOpen1Players = await seedPlayers(usnaGali, unsaGaliFC, mensOpen1, { count: 16, gender: 'M', minAge: 18, maxAge: 32 });
  const mensOpen1Staff = await seedTeamStaff(usnaGali, unsaGaliFC, mensOpen1, 'mens-open.unsa-gali-fc');
  clubReport2.teams.push({ name: 'Mens Open', slug: 'mens-open', players: mensOpen1Players.length, guardians: 0, staff: mensOpen1Staff });

  const a40_1 = await createTeam(usnaGali, unsaGaliFC, '40a', '40A', 'adult');
  const a40_1Players = await seedPlayers(usnaGali, unsaGaliFC, a40_1, { count: 16, gender: 'M', minAge: 40, maxAge: 55 });
  const a40_1Staff = await seedTeamStaff(usnaGali, unsaGaliFC, a40_1, '40a.unsa-gali-fc');
  clubReport2.teams.push({ name: '40A', slug: '40a', players: a40_1Players.length, guardians: 0, staff: a40_1Staff });

  orgReport.clubs.push(clubReport2);

  console.log('Seeding Copa Gali...');
  const copaGali = await createTournament(usnaGali, footballId, 'copa-gali', 'Copa Gali', 'Usna Gali Sports Complex', '2026-11-14');
  const usnaGaliOfficials = await seedOfficials(usnaGali, 4, 'copa-gali');
  const tourReport1 = { name: 'Copa Gali', slug: 'copa-gali', officials: usnaGaliOfficials.length, categories: [] };

  const FICTIONAL_CLUBS = ['Malaybalay Eagles FC', 'Valencia City Hawks', 'Iligan Falcons FC', 'Butuan Thunder FC', 'Cotabato Warriors FC', 'Ozamiz Blue Sharks'];
  let fictIdx = 0;

  const cgMens = await createCategory(usnaGali, copaGali, 'Mens Open', 'Open', null, null, '11-a-side, group stage + knockout');
  const cgMensEntry1 = await addEntry(usnaGali, copaGali, cgMens, { teamName: 'Unsa Gali FC', entrantOrgId: usnaGali.id, clubId: unsaGaliFC.id, teamId: mensOpen1.id });
  await addRosterFromPlayers(usnaGali, copaGali, cgMensEntry1, mensOpen1Players.slice(0, 14));
  const cgMensEntry2 = await addEntry(usnaGali, copaGali, cgMens, { teamName: FICTIONAL_CLUBS[fictIdx++] });
  await addFictionalRoster(usnaGali, copaGali, cgMensEntry2, 14, 'M', 18, 32);
  const cgMensEntry3 = await addEntry(usnaGali, copaGali, cgMens, { teamName: FICTIONAL_CLUBS[fictIdx++] });
  await addFictionalRoster(usnaGali, copaGali, cgMensEntry3, 14, 'M', 18, 32);
  await assignOfficials(usnaGali, copaGali, usnaGaliOfficials.slice(0, 3), ['referee', 'assistant_referee', 'fourth_official']);
  tourReport1.categories.push({ name: 'Mens Open', entries: 3 });

  const cgU15 = await createCategory(usnaGali, copaGali, 'U15 Mixed', 'U15', 2011, 2013, '9-a-side, round robin');
  const cgU15Entry1 = await addEntry(usnaGali, copaGali, cgU15, { teamName: 'Usna Gali FC (Girls)', entrantOrgId: usnaGali.id, clubId: usnaGaliFC.id, teamId: u15g.id });
  await addRosterFromPlayers(usnaGali, copaGali, cgU15Entry1, u15gPlayers);
  const cgU15Entry2 = await addEntry(usnaGali, copaGali, cgU15, { teamName: 'Usna Gali FC (Boys)', entrantOrgId: usnaGali.id, clubId: usnaGaliFC.id, teamId: u15b.id });
  await addRosterFromPlayers(usnaGali, copaGali, cgU15Entry2, u15bPlayers);
  const cgU15Entry3 = await addEntry(usnaGali, copaGali, cgU15, { teamName: FICTIONAL_CLUBS[fictIdx++] + ' Youth' });
  await addFictionalRoster(usnaGali, copaGali, cgU15Entry3, 12, 'M', 13, 15);
  tourReport1.categories.push({ name: 'U15 Mixed', entries: 3 });

  const cg40a = await createCategory(usnaGali, copaGali, '40A', 'Masters', null, null, '11-a-side, round robin');
  const cg40aEntry1 = await addEntry(usnaGali, copaGali, cg40a, { teamName: 'Unsa Gali FC', entrantOrgId: usnaGali.id, clubId: unsaGaliFC.id, teamId: a40_1.id });
  await addRosterFromPlayers(usnaGali, copaGali, cg40aEntry1, a40_1Players.slice(0, 14));
  const cg40aEntry2 = await addEntry(usnaGali, copaGali, cg40a, { teamName: FICTIONAL_CLUBS[fictIdx++] + ' Masters' });
  await addFictionalRoster(usnaGali, copaGali, cg40aEntry2, 14, 'M', 40, 55);
  const cg40aEntry3 = await addEntry(usnaGali, copaGali, cg40a, { teamName: FICTIONAL_CLUBS[fictIdx++] + ' Masters' });
  await addFictionalRoster(usnaGali, copaGali, cg40aEntry3, 14, 'M', 40, 55);
  tourReport1.categories.push({ name: '40A', entries: 3 });

  orgReport.tournaments.push(tourReport1);
  report.orgs.push(orgReport);

  // ------------------------------------------------------------
  // /demo personas -- one standing, real account per RBAC role, all
  // pointed at Usna Gali / Usna Gali FC / U15 Girls (the richest team:
  // players, guardians, coach, team manager, staff). Reuses the org
  // admin, club admin, coach, and team manager accounts already seeded
  // above rather than duplicating them; only adds the two roles nothing
  // else needed a real login for (platform admin, and one guardian+player
  // pair linked to an actual roster row).
  // ------------------------------------------------------------
  console.log('Wiring up /demo personas...');
  const demoPlatformAdminEmail = `demo-platformadmin@${EMAIL_DOMAIN}`;
  const demoPlatformAdminName = personName('F');
  const demoPlatformAdminId = await createPerson(demoPlatformAdminEmail, demoPlatformAdminName);
  await must(admin.from('platform_admins').insert({ email: demoPlatformAdminEmail }), 'platform_admins demo');

  const demoPlayer = u15gPlayers[0];
  const demoGuardian = u15gGuardians[0];
  const demoGuardianEmail = `demo-guardian.u15-girls.usna-gali-fc@${EMAIL_DOMAIN}`;
  const demoGuardianId = await createPerson(demoGuardianEmail, demoGuardian.name);
  await must(admin.from('guardians').update({ user_id: demoGuardianId, account_status: 'active' }).eq('id', demoGuardian.id), 'link demo guardian account');

  const demoPlayerEmail = `demo-player.u15-girls.usna-gali-fc@${EMAIL_DOMAIN}`;
  const demoPlayerId = await createPerson(demoPlayerEmail, demoPlayer.name);
  await must(admin.from('players').update({ user_id: demoPlayerId }).eq('id', demoPlayer.id), 'link demo player account');

  report.demoPersonas = {
    orgSlug: 'usna-gali', clubSlug: 'usna-gali-fc', teamSlug: 'u15-girls', tournamentSlug: 'copa-gali',
    platformAdmin: { name: demoPlatformAdminName, email: demoPlatformAdminEmail },
    orgAdmin: usnaGaliAdmin,
    clubAdmin: usnaGaliFCAdmin,
    coach: u15gStaff.coach,
    teamManager: u15gStaff.teamManager,
    staff: u15gStaff.staff,
    guardian: { name: demoGuardian.name, email: demoGuardianEmail },
    player: { name: demoPlayer.name, email: demoPlayerEmail },
  };

  // ============================================================
  // CDO Youth Sports Commission -- club only (tournament not entitled)
  // ============================================================
  console.log('Seeding CDO Youth Sports Commission...');
  const cdo = await createOrg('cdo-ysc', 'CDO Youth Sports Commission', '#2563EB', ['club']);
  const cdoAdmin = await addOrgAdmin(cdo, `orgadmin.cdo-ysc@${EMAIL_DOMAIN}`, personName('F'));
  const cdoReport = { name: 'CDO Youth Sports Commission', slug: 'cdo-ysc', orgAdmin: cdoAdmin, clubs: [], tournaments: [] };

  const cdoFC = await createClub(cdo, footballId, 'cdo-fc', 'CDO FC', 'Cagayan de Oro City', 'City-run youth development club under the CDO Youth Sports Commission.');
  const cdoFCAdmin = await seedClubAdmin(cdo, cdoFC, 'cdo-fc');
  const cdoClubReport1 = { name: cdoFC.name, slug: cdoFC.slug, admin: cdoFCAdmin, teams: [] };

  const u10 = await createTeam(cdo, cdoFC, 'u10', 'U10', 'grassroots');
  const u10Players = await seedPlayers(cdo, cdoFC, u10, { count: 10, gender: 'M', minAge: 8, maxAge: 10 });
  await seedGuardians(cdo, u10Players);
  const u10Staff = await seedTeamStaff(cdo, cdoFC, u10, 'u10.cdo-fc');
  cdoClubReport1.teams.push({ name: 'U10', slug: 'u10', players: u10Players.length, guardians: u10Players.length, staff: u10Staff });
  cdoReport.clubs.push(cdoClubReport1);

  const misor = await createClub(cdo, footballId, 'misor-footballers', 'Misamis Oriental Footballers', 'Gingoog City, Misamis Oriental', 'Provincial adult football club fielding open and masters squads.');
  const misorAdmin = await seedClubAdmin(cdo, misor, 'misor-footballers');
  const cdoClubReport2 = { name: misor.name, slug: misor.slug, admin: misorAdmin, teams: [] };

  const misorMens = await createTeam(cdo, misor, 'mens-open', 'Mens Open', 'adult');
  const misorMensPlayers = await seedPlayers(cdo, misor, misorMens, { count: 16, gender: 'M', minAge: 18, maxAge: 32 });
  const misorMensStaff = await seedTeamStaff(cdo, misor, misorMens, 'mens-open.misor-footballers');
  cdoClubReport2.teams.push({ name: 'Mens Open', slug: 'mens-open', players: misorMensPlayers.length, guardians: 0, staff: misorMensStaff });

  const misor40a = await createTeam(cdo, misor, '40a', '40A', 'adult');
  const misor40aPlayers = await seedPlayers(cdo, misor, misor40a, { count: 16, gender: 'M', minAge: 40, maxAge: 55 });
  const misor40aStaff = await seedTeamStaff(cdo, misor, misor40a, '40a.misor-footballers');
  cdoClubReport2.teams.push({ name: '40A', slug: '40a', players: misor40aPlayers.length, guardians: 0, staff: misor40aStaff });

  cdoReport.clubs.push(cdoClubReport2);
  report.orgs.push(cdoReport);

  // ============================================================
  // Pilipinas Futbol -- tournament only (no club entitlement)
  // ============================================================
  console.log('Seeding Pilipinas Futbol...');
  const pilipinas = await createOrg('pilipinas-futbol', 'Pilipinas Futbol', '#CE1126', ['tournament']);
  const pilipinasAdmin = await addOrgAdmin(pilipinas, `orgadmin.pilipinas-futbol@${EMAIL_DOMAIN}`, personName('M'));
  const pilipinasReport = { name: 'Pilipinas Futbol', slug: 'pilipinas-futbol', orgAdmin: pilipinasAdmin, clubs: [], tournaments: [] };
  const pilipinasOfficials = await seedOfficials(pilipinas, 4, 'pilipinas-futbol');
  const PILIPINAS_ENTRIES = ['Philippines', 'Vietnam', 'Thailand'];

  async function seedNationalTournament(org, officials, slug, name, venue, eventDate, entryNames) {
    const tournament = await createTournament(org, footballId, slug, name, venue, eventDate);
    const tourReport = { name, slug, officials: officials.length, categories: [] };
    for (const [catName, gender, minAge, maxAge] of [['Mens Open', 'M', 19, 29], ['Womens Open', 'F', 18, 28]]) {
      const category = await createCategory(org, tournament, catName, 'Open', null, null, '11-a-side, group stage + knockout');
      for (const entryName of entryNames) {
        const entry = await addEntry(org, tournament, category, { teamName: entryName });
        await addFictionalRoster(org, tournament, entry, 16, gender, minAge, maxAge);
      }
      tourReport.categories.push({ name: catName, entries: entryNames.length });
    }
    await assignOfficials(org, tournament, officials.slice(0, 3), ['referee', 'assistant_referee', 'commissioner']);
    return tourReport;
  }

  pilipinasReport.tournaments.push(await seedNationalTournament(pilipinas, pilipinasOfficials, 'tiger-cup', 'Tiger Cup', 'Rizal Memorial Stadium, Manila', '2026-12-05', PILIPINAS_ENTRIES));
  pilipinasReport.tournaments.push(await seedNationalTournament(pilipinas, pilipinasOfficials, 'national-team-qualifiers', 'National Team Qualifiers', 'Philippine Sports Stadium, Bulacan', '2027-02-20', PILIPINAS_ENTRIES));
  report.orgs.push(pilipinasReport);

  // ============================================================
  // Davao Unity Sports -- tournament only, regional flavor
  // ============================================================
  console.log('Seeding Davao Unity Sports...');
  const davao = await createOrg('davao-unity-sports', 'Davao Unity Sports', '#7C3AED', ['tournament']);
  const davaoAdmin = await addOrgAdmin(davao, `orgadmin.davao-unity-sports@${EMAIL_DOMAIN}`, personName('F'));
  const davaoReport = { name: 'Davao Unity Sports', slug: 'davao-unity-sports', orgAdmin: davaoAdmin, clubs: [], tournaments: [] };
  const davaoOfficials = await seedOfficials(davao, 4, 'davao-unity-sports');
  const DAVAO_ENTRIES = ['Team Davao Region', 'Team Zamboanga Peninsula', 'Team CARAGA'];

  davaoReport.tournaments.push(await seedNationalTournament(davao, davaoOfficials, 'tiger-cup', 'Tiger Cup', 'Davao del Norte Sports Complex', '2026-12-05', DAVAO_ENTRIES));
  davaoReport.tournaments.push(await seedNationalTournament(davao, davaoOfficials, 'national-team-qualifiers', 'National Team Qualifiers', 'University of Mindanao Stadium', '2027-02-20', DAVAO_ENTRIES));
  report.orgs.push(davaoReport);

  // ---------- write the doc ----------
  writeReport(report);
  console.log('\nDone. See docs/demo-data-showcase.md for the full breakdown.');
  console.log(`Shared password for every seeded login: ${PASSWORD}`);
}

function writeReport(report) {
  const lines = [];
  lines.push('# Showcase demo data');
  lines.push('');
  lines.push(`Seeded by \`scripts/seed-showcase-demo.mjs\` on ${new Date().toISOString().slice(0, 10)}. Replaces every`);
  lines.push('prior ad-hoc demo/test org (`dulahq-rbac-demo`, `dula-demo`, `damilagsc`, `agusan-yd`) with one');
  lines.push('coherent dataset exercising every entitlement combination: club+tournament, club-only, and');
  lines.push('tournament-only (x2, one national-federation flavored, one regional).');
  lines.push('');
  lines.push(`Shared password for every login below: \`${PASSWORD}\``);
  lines.push('');
  lines.push('Re-run the script any time to reset this dataset -- it wipes its own prior run first (by org slug');
  lines.push(`and by the \`@${EMAIL_DOMAIN}\` email domain), and never touches real accounts.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (report.demoPersonas) {
    const d = report.demoPersonas;
    lines.push('## Try it as any role (`/demo`)');
    lines.push('');
    lines.push(`One standing account per RBAC role, all pointed at Usna Gali FC's U15 Girls team`);
    lines.push(`(\`/c/${d.clubSlug}/teams/${d.teamSlug}\`) and the Copa Gali tournament (\`/t/${d.orgSlug}/${d.tournamentSlug}\`).`);
    lines.push('');
    lines.push('| Role | Name | Email |');
    lines.push('|---|---|---|');
    lines.push(`| Platform admin | ${d.platformAdmin.name} | \`${d.platformAdmin.email}\` |`);
    lines.push(`| Org admin (Usna Gali) | ${d.orgAdmin.name} | \`${d.orgAdmin.email}\` |`);
    lines.push(`| Club admin (Usna Gali FC) | ${d.clubAdmin.name} | \`${d.clubAdmin.email}\` |`);
    lines.push(`| Coach (U15 Girls) | ${d.coach.name} | \`${d.coach.email}\` |`);
    lines.push(`| Team manager (U15 Girls) | ${d.teamManager.name} | \`${d.teamManager.email}\` |`);
    lines.push(`| Staff (Usna Gali FC) | ${d.staff.name} | \`${d.staff.email}\` |`);
    lines.push(`| Guardian | ${d.guardian.name} | \`${d.guardian.email}\` |`);
    lines.push(`| Player | ${d.player.name} | \`${d.player.email}\` |`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  for (const org of report.orgs) {
    lines.push(`## ${org.name}`);
    lines.push('');
    lines.push(`- Org: \`/platformconsole\` → ${org.name} (slug \`${org.slug}\`)`);
    lines.push(`- Org admin: **${org.orgAdmin.name}** — \`${org.orgAdmin.email}\``);
    lines.push('');

    if (org.clubs.length === 0) {
      lines.push('_No club entitlement._');
      lines.push('');
    }
    for (const club of org.clubs) {
      lines.push(`### Club: ${club.name} (\`/c/${club.slug}\`)`);
      lines.push('');
      lines.push(`Club admin: **${club.admin.name}** — \`${club.admin.email}\``);
      lines.push('');
      lines.push('| Team | Players | Guardians | Coach | Team manager | Staff |');
      lines.push('|---|---|---|---|---|---|');
      for (const t of club.teams) {
        if (t.staff) {
          lines.push(`| ${t.name} | ${t.players} | ${t.guardians} | ${t.staff.coach.name} (\`${t.staff.coach.email}\`) | ${t.staff.teamManager.name} (\`${t.staff.teamManager.email}\`) | ${t.staff.staff.name} (\`${t.staff.staff.email}\`) |`);
        } else {
          lines.push(`| ${t.name} | ${t.players} | ${t.guardians} | — | — | — |`);
        }
      }
      lines.push('');
    }

    if (org.tournaments.length === 0) {
      lines.push('_No tournament entitlement._');
      lines.push('');
    }
    for (const t of org.tournaments) {
      lines.push(`### Tournament: ${t.name} (\`/t/${org.slug}/${t.slug}\`)`);
      lines.push('');
      lines.push(`${t.officials} org officials seeded, 3 assigned to this tournament.`);
      lines.push('');
      lines.push('| Category | Entries |');
      lines.push('|---|---|');
      for (const c of t.categories) lines.push(`| ${c.name} | ${c.entries} |`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  writeFileSync('docs/demo-data-showcase.md', lines.join('\n'));
}

main().catch((err) => {
  console.error('SEED FAILED:', err.message);
  process.exit(1);
});

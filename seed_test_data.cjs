/**
 * seed_test_data.cjs
 * Seeds clearly-labelled dummy/test records across all three orgs.
 * Safe to re-run — checks existence before creating.
 * All passwords: Test@2026
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL, {});
const prisma = new PrismaClient({ adapter });

// ─── helpers ────────────────────────────────────────────────────────────────
const dob = (year, month = 6, day = 15) => new Date(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
const past = (daysAgo) => { const d = new Date("2026-06-20"); d.setDate(d.getDate() - daysAgo); return d; };
const future = (daysAhead) => { const d = new Date("2026-06-20"); d.setDate(d.getDate() + daysAhead); return d; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function retry(fn, attempts = 5, delayMs = 3000) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === attempts - 1) throw e;
      const isTimeout = e?.sourceError?.cause?.code === "ETIMEDOUT" || e?.code === "ETIMEDOUT";
      if (!isTimeout) throw e;
      console.log(`  Network timeout — retrying in ${delayMs / 1000}s (${i + 1}/${attempts - 1})...`);
      await sleep(delayMs);
    }
  }
}

async function q(fn) { return retry(fn); }

async function main() {
  const PASSWORD_HASH = await bcrypt.hash("Test@2026", 12);

  // ── fetch orgs (with retry on cold-start timeout) ─────────────────────────
  const lerato   = await q(() => prisma.organization.findFirstOrThrow({ where: { slug: "lerato" } }));
  const darajani = await q(() => prisma.organization.findFirstOrThrow({ where: { slug: "darajani" } }));
  const agape    = await q(() => prisma.organization.findFirstOrThrow({ where: { slug: "agape" } }));
  const elite    = await q(() => prisma.branch.findFirst({ where: { organizationId: darajani.id, name: "Darajani Elite" } }));

  console.log("Orgs loaded:", lerato.shortName, "/", darajani.shortName, "/", agape.shortName);

  // ════════════════════════════════════════════════════════
  // 1. TEST USERS
  // ════════════════════════════════════════════════════════
  const userDefs = [
    { email: "test.coordinator@lerato.dummy", name: "Test Coordinator" },
    { email: "dummy.finance@lerato.dummy",    name: "Dummy Finance User" },
    { email: "test.observer@lerato.dummy",    name: "Test Observer" },
  ];

  const users = {};
  for (const u of userDefs) {
    let user = await q(() => prisma.user.findUnique({ where: { email: u.email } }));
    if (!user) {
      user = await q(() => prisma.user.create({
        data: { email: u.email, name: u.name, hashedPassword: PASSWORD_HASH, active: true },
      }));
      console.log(`✓ User created: ${u.name}`);
    } else {
      console.log(`  User exists: ${u.name}`);
    }
    users[u.email] = user;
  }

  // Memberships
  const membershipDefs = [
    { userId: users["test.coordinator@lerato.dummy"].id, orgId: lerato.id,   role: "PROGRAMME_MANAGER" },
    { userId: users["test.coordinator@lerato.dummy"].id, orgId: darajani.id, role: "PROGRAMME_MANAGER" },
    { userId: users["test.coordinator@lerato.dummy"].id, orgId: agape.id,    role: "PROGRAMME_MANAGER" },
    { userId: users["dummy.finance@lerato.dummy"].id,    orgId: lerato.id,   role: "FINANCE" },
    { userId: users["dummy.finance@lerato.dummy"].id,    orgId: darajani.id, role: "FINANCE" },
    { userId: users["test.observer@lerato.dummy"].id,    orgId: lerato.id,   role: "BOARD_OBSERVER" },
    { userId: users["test.observer@lerato.dummy"].id,    orgId: darajani.id, role: "BOARD_OBSERVER" },
    { userId: users["test.observer@lerato.dummy"].id,    orgId: agape.id,    role: "BOARD_OBSERVER" },
  ];
  for (const m of membershipDefs) {
    const existing = await q(() => prisma.membership.findUnique({
      where: { userId_organizationId: { userId: m.userId, organizationId: m.orgId } },
    }));
    if (!existing) {
      await q(() => prisma.membership.create({
        data: { userId: m.userId, organizationId: m.orgId, role: m.role, permissions: [], active: true },
      }));
    }
  }
  console.log("✓ Memberships set");

  // ════════════════════════════════════════════════════════
  // 2. DARAJANI — TEST ATHLETES (10)
  // ════════════════════════════════════════════════════════
  const athletes = [
    { firstName: "Test",  lastName: "Striker One",  gender: "MALE",   dob: dob(2008,3,12), county: "Kajiado", position: "ST",  foot: "RIGHT", jersey: 9,  heightCm: 176, weightKg: 68 },
    { firstName: "Test",  lastName: "Keeper Dummy",  gender: "MALE",   dob: dob(2007,8,5),  county: "Kajiado", position: "GK",  foot: "RIGHT", jersey: 1,  heightCm: 183, weightKg: 79 },
    { firstName: "Dummy", lastName: "Winger Female", gender: "FEMALE", dob: dob(2009,1,20), county: "Kajiado", position: "RW",  foot: "LEFT",  jersey: 7,  heightCm: 163, weightKg: 56 },
    { firstName: "Test",  lastName: "Midfielder Two", gender: "MALE",  dob: dob(2008,11,3), county: "Nairobi", position: "CM",  foot: "BOTH",  jersey: 8,  heightCm: 172, weightKg: 65 },
    { firstName: "Dummy", lastName: "Defender One",  gender: "MALE",   dob: dob(2007,5,17), county: "Kajiado", position: "CB",  foot: "RIGHT", jersey: 5,  heightCm: 180, weightKg: 76 },
    { firstName: "Test",  lastName: "Forward Female", gender: "FEMALE", dob: dob(2009,7,9), county: "Machakos", position: "CF", foot: "RIGHT", jersey: 10, heightCm: 168, weightKg: 60 },
    { firstName: "Dummy", lastName: "Fullback Three", gender: "MALE",  dob: dob(2010,2,28), county: "Kajiado", position: "LB",  foot: "LEFT",  jersey: 3,  heightCm: 170, weightKg: 63 },
    { firstName: "Test",  lastName: "Attacker Four",  gender: "MALE",  dob: dob(2008,9,14), county: "Kisumu",  position: "SS",  foot: "RIGHT", jersey: 11, heightCm: 174, weightKg: 67 },
    { firstName: "Dummy", lastName: "Midfielder Five", gender: "FEMALE", dob: dob(2009,4,22), county: "Nairobi", position: "DM", foot: "RIGHT", jersey: 6, heightCm: 165, weightKg: 58 },
    { firstName: "Test",  lastName: "Defender Six",   gender: "MALE",  dob: dob(2007,12,1), county: "Kajiado", position: "RB",  foot: "RIGHT", jersey: 2,  heightCm: 178, weightKg: 73 },
  ];

  let athleteCount = 0;
  for (const a of athletes) {
    const existing = await q(() => prisma.beneficiary.findFirst({
      where: { organizationId: darajani.id, firstName: a.firstName, lastName: a.lastName },
    }));
    if (existing) { continue; }
    const benef = await q(() => prisma.beneficiary.create({
      data: { organizationId: darajani.id, firstName: a.firstName, lastName: a.lastName, dateOfBirth: a.dob, gender: a.gender, county: a.county, branchId: a.jersey <= 3 ? (elite?.id ?? null) : null },
    }));
    await q(() => prisma.athleteProfile.create({
      data: { beneficiaryId: benef.id, jerseyNumber: a.jersey, position: a.position, preferredFoot: a.foot, heightCm: a.heightCm, weightKg: a.weightKg },
    }));
    athleteCount++;
  }
  console.log(`✓ ${athleteCount} new test athletes added to Darajani`);

  // ════════════════════════════════════════════════════════
  // 3. LERATO — TEST STUDENTS (5)
  // ════════════════════════════════════════════════════════
  const students = [
    { firstName: "Test",  lastName: "Student Alpha",  gender: "FEMALE", dob: dob(2010,3,5),  county: "Nairobi",  school: "Dummy Primary School", grade: "Grade 7" },
    { firstName: "Dummy", lastName: "Scholar Beta",   gender: "MALE",   dob: dob(2009,7,14), county: "Kiambu",   school: "Test Secondary High",  grade: "Form 2" },
    { firstName: "Test",  lastName: "Student Gamma",  gender: "MALE",   dob: dob(2011,1,22), county: "Mombasa",  school: "Dummy Primary School", grade: "Grade 5" },
    { firstName: "Dummy", lastName: "Scholar Delta",  gender: "FEMALE", dob: dob(2008,9,30), county: "Nakuru",   school: "Test Secondary High",  grade: "Form 3" },
    { firstName: "Test",  lastName: "Student Epsilon", gender: "MALE",  dob: dob(2012,5,18), county: "Nairobi",  school: "Dummy Primary School", grade: "Grade 3" },
  ];

  let studentCount = 0;
  for (const s of students) {
    const existing = await q(() => prisma.beneficiary.findFirst({
      where: { organizationId: lerato.id, firstName: s.firstName, lastName: s.lastName },
    }));
    if (existing) continue;
    const sBenef = await q(() => prisma.beneficiary.create({
      data: { organizationId: lerato.id, firstName: s.firstName, lastName: s.lastName, dateOfBirth: s.dob, gender: s.gender, county: s.county },
    }));
    await q(() => prisma.studentProfile.create({
      data: { beneficiaryId: sBenef.id, school: s.school, grade: s.grade, scholarshipType: "FULL" },
    }));
    studentCount++;
  }
  console.log(`✓ ${studentCount} new test students added to Lerato`);

  // ════════════════════════════════════════════════════════
  // 4. AGAPE — TEST BENEFICIARIES (5)
  // ════════════════════════════════════════════════════════
  const communityMembers = [
    { firstName: "Test",  lastName: "Community One",   gender: "MALE",   dob: dob(1990,4,10), county: "Nairobi"  },
    { firstName: "Dummy", lastName: "Beneficiary Two", gender: "FEMALE", dob: dob(1985,8,25), county: "Kibera"   },
    { firstName: "Test",  lastName: "Community Three", gender: "FEMALE", dob: dob(1995,2,3),  county: "Mathare"  },
    { firstName: "Dummy", lastName: "Recipient Four",  gender: "MALE",   dob: dob(1978,11,19),county: "Korogocho"},
    { firstName: "Test",  lastName: "Community Five",  gender: "FEMALE", dob: dob(1992,6,7),  county: "Nairobi"  },
  ];

  let communityCount = 0;
  for (const c of communityMembers) {
    const existing = await q(() => prisma.beneficiary.findFirst({
      where: { organizationId: agape.id, firstName: c.firstName, lastName: c.lastName },
    }));
    if (existing) continue;
    await q(() => prisma.beneficiary.create({
      data: { organizationId: agape.id, firstName: c.firstName, lastName: c.lastName, dateOfBirth: c.dob, gender: c.gender, county: c.county },
    }));
    communityCount++;
  }
  console.log(`✓ ${communityCount} new test community members added to Agape`);

  // ════════════════════════════════════════════════════════
  // 5. TEST DONORS (3)
  // ════════════════════════════════════════════════════════
  const donorDefs = [
    { firstName: "Test",  lastName: "Donor Individual", type: "INDIVIDUAL",   tier: "SILVER", email: "test.donor.individual@dummy.test", orgs: [lerato.id, darajani.id, agape.id] },
    { organizationName: "Dummy Corp Ltd",                type: "ORGANIZATION", tier: "GOLD",   email: "donations@dummycorp.test",         orgs: [lerato.id] },
    { firstName: "Dummy", lastName: "Patron Sponsor",   type: "INDIVIDUAL",   tier: "PATRON", email: "dummy.patron@dummy.test",           orgs: [darajani.id] },
  ];

  for (const d of donorDefs) {
    let donor = await q(() => prisma.donor.findFirst({ where: { email: d.email } }));
    if (!donor) {
      donor = await q(() => prisma.donor.create({
        data: { type: d.type, firstName: d.firstName, lastName: d.lastName, organizationName: d.organizationName, email: d.email, tier: d.tier, country: "Kenya" },
      }));
      console.log(`✓ Donor created: ${d.firstName ?? d.organizationName}`);
    }
    for (const orgId of d.orgs) {
      const shareExists = await q(() => prisma.donorShare.findUnique({
        where: { donorId_organizationId: { donorId: donor.id, organizationId: orgId } },
      }));
      if (!shareExists) {
        await q(() => prisma.donorShare.create({ data: { donorId: donor.id, organizationId: orgId } }));
      }
    }
  }
  console.log("✓ Test donors set");

  // ════════════════════════════════════════════════════════
  // 6. TEST TRANSACTIONS
  // ════════════════════════════════════════════════════════
  const txDefs = [
    // Darajani
    { orgId: darajani.id, type: "INCOME",  amount: 500000, category: "Grant",     description: "TEST — Academy Operations Grant (Dummy Funder)", occurredAt: past(45) },
    { orgId: darajani.id, type: "INCOME",  amount: 150000, category: "Donation",  description: "TEST — Equipment Fund Donation (Dummy Donor)",   occurredAt: past(30) },
    { orgId: darajani.id, type: "EXPENSE", amount: 85000,  category: "Equipment", description: "TEST — Training Gear & Boots Purchase",           occurredAt: past(25) },
    { orgId: darajani.id, type: "EXPENSE", amount: 45000,  category: "Transport", description: "TEST — Away Tournament Transport",                occurredAt: past(14) },
    { orgId: darajani.id, type: "EXPENSE", amount: 30000,  category: "Catering",  description: "TEST — Monthly Training Camp Meals",              occurredAt: past(7)  },
    // Lerato
    { orgId: lerato.id,  type: "INCOME",  amount: 1000000, category: "Grant",     description: "TEST — Foundation Core Operations Grant",          occurredAt: past(60) },
    { orgId: lerato.id,  type: "INCOME",  amount: 250000,  category: "Donation",  description: "TEST — Dummy Corp Ltd CSR Contribution",           occurredAt: past(20) },
    { orgId: lerato.id,  type: "EXPENSE", amount: 350000,  category: "Allocation",description: "TEST — Programme Support Transfer to Darajani",    occurredAt: past(15) },
    // Agape
    { orgId: agape.id,  type: "INCOME",  amount: 200000, category: "Donation",   description: "TEST — Community Support Fund (Dummy Donor)",       occurredAt: past(40) },
    { orgId: agape.id,  type: "EXPENSE", amount: 75000,  category: "Supplies",   description: "TEST — Medical Camp Supplies — Kibera",             occurredAt: past(10) },
    { orgId: agape.id,  type: "EXPENSE", amount: 28000,  category: "Transport",  description: "TEST — Field Team Transport",                        occurredAt: past(3)  },
  ];

  let txCount = 0;
  for (const tx of txDefs) {
    const existing = await q(() => prisma.transaction.findFirst({ where: { organizationId: tx.orgId, description: tx.description } }));
    if (!existing) {
      await q(() => prisma.transaction.create({
        data: { organizationId: tx.orgId, type: tx.type, amount: tx.amount, currency: "KES", category: tx.category, description: tx.description, occurredAt: tx.occurredAt },
      }));
      txCount++;
    }
  }
  console.log(`✓ ${txCount} new test transactions created`);

  // ════════════════════════════════════════════════════════
  // 7. TEST EVENTS
  // ════════════════════════════════════════════════════════
  const eventDefs = [
    { orgId: darajani.id, name: "TEST — Inter-Academy Cup 2026",         type: "TOURNAMENT",    venue: "Nyayo Stadium, Nairobi",      startsAt: future(35), endsAt: future(36), capacity: 500 },
    { orgId: darajani.id, name: "TEST — Pre-Season Training Camp",       type: "TRAINING_CAMP", venue: "Kiserian Training Ground",   startsAt: future(10), endsAt: future(13)              },
    { orgId: darajani.id, name: "TEST — Darajani Fundraiser Dinner",     type: "FUNDRAISER",    venue: "Villa Rosa Kempinski, Nairobi", startsAt: future(60), endsAt: future(60), capacity: 120 },
    { orgId: agape.id,   name: "TEST — Community Medical Camp Kibera",  type: "COMMUNITY_DAY", venue: "Kibera Community Centre",     startsAt: future(25), endsAt: future(25)              },
    { orgId: lerato.id,  name: "TEST — Q3 Board Meeting",               type: "BOARD_MEETING", venue: "Lerato Foundation HQ",        startsAt: future(40), endsAt: future(40), capacity: 15 },
  ];

  let evtCount = 0;
  for (const e of eventDefs) {
    const existing = await q(() => prisma.event.findFirst({ where: { organizationId: e.orgId, name: e.name } }));
    if (!existing) {
      await q(() => prisma.event.create({
        data: { organizationId: e.orgId, name: e.name, type: e.type, venue: e.venue, startsAt: e.startsAt, endsAt: e.endsAt ?? null, status: "SCHEDULED", capacity: e.capacity ?? null },
      }));
      evtCount++;
    }
  }
  console.log(`✓ ${evtCount} new test events created`);

  // ════════════════════════════════════════════════════════
  // 8. TEST STAFF & VOLUNTEERS
  // ════════════════════════════════════════════════════════
  const staffDefs = [
    { orgId: darajani.id, firstName: "Test",  lastName: "Head Coach",      type: "COACH",     position: "Head Coach",           branchId: null         },
    { orgId: darajani.id, firstName: "Dummy", lastName: "Assistant Coach", type: "COACH",     position: "Assistant Coach",      branchId: elite?.id    },
    { orgId: darajani.id, firstName: "Test",  lastName: "Physio Staff",    type: "EMPLOYEE",  position: "Physiotherapist",      branchId: null         },
    { orgId: darajani.id, firstName: "Dummy", lastName: "Volunteer One",   type: "VOLUNTEER", position: "Training Assistant",   branchId: elite?.id    },
    { orgId: agape.id,   firstName: "Test",  lastName: "Field Officer",   type: "EMPLOYEE",  position: "Field Officer",        branchId: null         },
    { orgId: agape.id,   firstName: "Dummy", lastName: "Volunteer Two",   type: "VOLUNTEER", position: "Community Volunteer",  branchId: null         },
    { orgId: lerato.id,  firstName: "Test",  lastName: "Programme Mgr",   type: "EMPLOYEE",  position: "Programme Manager",    branchId: null         },
  ];

  let staffCount = 0;
  for (const s of staffDefs) {
    const existing = await q(() => prisma.staffVolunteer.findFirst({
      where: { organizationId: s.orgId, firstName: s.firstName, lastName: s.lastName },
    }));
    if (!existing) {
      await q(() => prisma.staffVolunteer.create({
        data: { organizationId: s.orgId, firstName: s.firstName, lastName: s.lastName, type: s.type, position: s.position, branchId: s.branchId, active: true, startDate: past(90) },
      }));
      staffCount++;
    }
  }
  console.log(`✓ ${staffCount} new test staff/volunteers created`);

  // ────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────
  console.log("\n════════ DONE ════════");
  console.log("Test password for all users: Test@2026");
  console.log("Users: test.coordinator@lerato.dummy / dummy.finance@lerato.dummy / test.observer@lerato.dummy");
}

main().catch(console.error).finally(() => prisma.$disconnect());

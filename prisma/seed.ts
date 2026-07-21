/**
 * Lerato Platform — Seed Data
 *
 * Bootstraps the database with:
 *   - 3 organizations (Lerato Foundation, Darajani Sports Academy, Agape in Action)
 *   - 1 super-admin user (Victor) with admin role across all three
 *   - 1 sponsor user (Simon) with admin role on Lerato + Darajani
 *   - 1 mission-lead user (Martha) with admin role on Agape
 *   - Sample programmes per org
 *   - Sample beneficiary, donor, partner records for demo
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient, OrgType, Role, ProgramType, DonorType, DonorTier, PartnerType, CommType, ReportType, AccountType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

// Use pg adapter for seed — supports transactions (upsert, createMany with skipDuplicates).
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("→ Seeding Lerato Platform...");

  // ──────────────────────────────────────────────────────────────────
  // ORGANIZATIONS
  // ──────────────────────────────────────────────────────────────────
  const lerato = await prisma.organization.upsert({
    where: { slug: "lerato" },
    update: {},
    create: {
      slug: "lerato",
      name: "Lerato Foundation",
      shortName: "Lerato",
      legalName: "Lerato Foundation (formerly Unawiri Children Foundation)",
      type: OrgType.FOUNDATION,
      email: "info@leratofoundation.org",
      phone: "+254743838384",
      whatsapp: "+254743838384",
      website: "https://leratofoundation.org",
      country: "Kenya",
      primaryColor: "#1E40AF",   // foundation blue
      secondaryColor: "#231F20",
      accentColor: "#ED1C24",
    },
  });

  const darajani = await prisma.organization.upsert({
    where: { slug: "darajani" },
    update: {},
    create: {
      slug: "darajani",
      name: "Darajani Sports Academy",
      shortName: "Darajani",
      type: OrgType.ACADEMY,
      county: "Kajiado",
      country: "Kenya",
      primaryColor: "#16A34A",   // sports green
      secondaryColor: "#231F20",
      accentColor: "#FACC15",
    },
  });

  const agape = await prisma.organization.upsert({
    where: { slug: "agape" },
    update: {},
    create: {
      slug: "agape",
      name: "Agape in Action",
      shortName: "Agape",
      type: OrgType.MISSION,
      country: "Kenya",
      primaryColor: "#7C3AED",   // mission purple
      secondaryColor: "#231F20",
      accentColor: "#F59E0B",
    },
  });

  console.log("  ✓ 3 organizations created");

  // ──────────────────────────────────────────────────────────────────
  // USERS
  // ──────────────────────────────────────────────────────────────────
  const victorPassword = await hash("change-me-on-first-login", 12);
  const victor = await prisma.user.upsert({
    where: { email: "victor@victormuoki.com" },
    update: {},
    create: {
      email: "victor@victormuoki.com",
      name: "Victor Muoki",
      hashedPassword: victorPassword,
      emailVerified: new Date(),
    },
  });

  const simon = await prisma.user.upsert({
    where: { email: "simon@leratofoundation.org" },
    update: {},
    create: {
      email: "simon@leratofoundation.org",
      name: "Simon Kyenze Peter",
      hashedPassword: victorPassword,
      emailVerified: new Date(),
    },
  });

  const martha = await prisma.user.upsert({
    where: { email: "martha@agapeinaction.org" },
    update: {},
    create: {
      email: "martha@agapeinaction.org",
      name: "Martha Sales",
      hashedPassword: victorPassword,
      emailVerified: new Date(),
    },
  });

  console.log("  ✓ 3 users created (Victor, Simon, Martha)");

  // ──────────────────────────────────────────────────────────────────
  // MEMBERSHIPS — who can access which org and as what role
  // ──────────────────────────────────────────────────────────────────
  // Victor: admin across all three
  for (const org of [lerato, darajani, agape]) {
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: victor.id, organizationId: org.id } },
      update: {},
      create: { userId: victor.id, organizationId: org.id, role: Role.ADMIN, permissions: [] },
    });
  }
  // Simon: admin on Lerato + Darajani
  for (const org of [lerato, darajani]) {
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: simon.id, organizationId: org.id } },
      update: {},
      create: { userId: simon.id, organizationId: org.id, role: Role.ADMIN, permissions: [] },
    });
  }
  // Martha: admin on Agape
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: martha.id, organizationId: agape.id } },
    update: {},
    create: { userId: martha.id, organizationId: agape.id, role: Role.ADMIN, permissions: [] },
  });

  console.log("  ✓ Memberships configured");

  // ──────────────────────────────────────────────────────────────────
  // PROGRAMMES — one per programme type, per relevant org
  // ──────────────────────────────────────────────────────────────────
  await prisma.program.createMany({
    data: [
      // Lerato — all five core programmes
      { organizationId: lerato.id, type: ProgramType.EDUCATION,     name: "Education Support Programme",       description: "Scholarships for academically gifted but financially challenged learners." },
      { organizationId: lerato.id, type: ProgramType.LIFE_PROGRAM,  name: "Life Programme",                     description: "A Meal A Day + clean water access for households served." },
      { organizationId: lerato.id, type: ProgramType.MENTORSHIP,    name: "Mentorship Programme",               description: "Guiding students and youth to discover talents and maximize potential." },
      { organizationId: lerato.id, type: ProgramType.COMMUNITY_DEV, name: "Community Development",              description: "Vocational training, leadership development, and partnerships." },
      // Darajani — sports
      { organizationId: darajani.id, type: ProgramType.SPORTS_DARAJANI, name: "Darajani Football Academy", description: "Elite youth football training with holistic personal development." },
      // Agape — missions
      { organizationId: agape.id, type: ProgramType.AGAPE_MISSION, name: "World Cup Engagement Programme 2026", description: "Cross-continental engagement mission tied to the 2026 World Cup." },
    ],
    skipDuplicates: true,
  });

  console.log("  ✓ 6 programmes seeded");

  // ──────────────────────────────────────────────────────────────────
  // PARTNERSHIPS — Lerato's known partners (per leratofoundation.org)
  // ──────────────────────────────────────────────────────────────────
  await prisma.partnership.createMany({
    data: [
      // Strategic
      { organizationId: lerato.id, partnerName: "Agape in Action", partnerType: PartnerType.STRATEGIC },
      { organizationId: lerato.id, partnerName: "Christian Family", partnerType: PartnerType.STRATEGIC },
      { organizationId: lerato.id, partnerName: "A Meal A Day Group", partnerType: PartnerType.STRATEGIC },
      // Community
      { organizationId: lerato.id, partnerName: "SABYA", partnerType: PartnerType.COMMUNITY },
      { organizationId: lerato.id, partnerName: "Youngfounders Group", partnerType: PartnerType.COMMUNITY },
      { organizationId: lerato.id, partnerName: "Hope Network", partnerType: PartnerType.COMMUNITY },
      { organizationId: lerato.id, partnerName: "Ndlovu Network", partnerType: PartnerType.COMMUNITY },
      { organizationId: lerato.id, partnerName: "Culture Hub", partnerType: PartnerType.COMMUNITY },
      { organizationId: lerato.id, partnerName: "Kibwezi West Hub", partnerType: PartnerType.COMMUNITY },
      // Supporting
      { organizationId: lerato.id, partnerName: "Ubuntu Aspire Foundation", partnerType: PartnerType.SUPPORTING },
      { organizationId: lerato.id, partnerName: "Global Youth Mobilization", partnerType: PartnerType.SUPPORTING },
      { organizationId: lerato.id, partnerName: "Youth Empowerment Fund", partnerType: PartnerType.SUPPORTING },
      { organizationId: lerato.id, partnerName: "UK Christian Youth Circle", partnerType: PartnerType.SUPPORTING },
      { organizationId: lerato.id, partnerName: "China Christian Youth Circle", partnerType: PartnerType.SUPPORTING },
      { organizationId: lerato.id, partnerName: "Birmingham Christian Family", partnerType: PartnerType.SUPPORTING },
    ],
    skipDuplicates: true,
  });

  console.log("  ✓ 15 Lerato partnerships seeded");

  // ──────────────────────────────────────────────────────────────────
  // DEMO MISSION — World Cup Engagement Programme
  // ──────────────────────────────────────────────────────────────────
  const missionExists = await prisma.mission.findFirst({ where: { organizationId: agape.id, name: "World Cup Engagement Programme 2026" } });
  if (!missionExists) await prisma.mission.create({
    data: {
      organizationId: agape.id,
      name: "World Cup Engagement Programme 2026",
      type: "ENGAGEMENT_PROGRAMME",
      destination: "TBC",
      countries: ["TBC"],
      departureDate: new Date("2026-07-07"),
      status: "PLANNING",
      description: "Cross-continental engagement mission tied to the 2026 FIFA World Cup. Postponed from 17 June to 7 July.",
      delegates: {
        create: [
          { firstName: "Simon", lastName: "Kyenze Peter", role: "Delegation Lead" },
          { firstName: "James", lastName: "Muigai Karugu", role: "Delegate" },
          { firstName: "Felix", lastName: "Muhoho", role: "Delegate" },
          { firstName: "Victor", lastName: "Muoki", role: "Delegate" },
          { firstName: "Hayley", lastName: "Trevor", role: "Accompanying" },
          { firstName: "Luke", lastName: "Abraham", role: "Accompanying" },
          { firstName: "Hanfield", lastName: "Simon", role: "Accompanying" },
        ],
      },
    },
  });

  console.log("  ✓ Sample mission seeded with delegate roster");

  // ──────────────────────────────────────────────────────────────────
  // APPROVAL RULES — default thresholds per org
  // ──────────────────────────────────────────────────────────────────
  // 0 — 49,999 KES   → 1 approver (FINANCE_LEAD or ADMIN)
  // 50K — 249,999 KES → 2 approvers (FINANCE_LEAD + ADMIN)
  // 250K+ KES         → 3 approvers (FINANCE_LEAD + ADMIN + BOARD_MEMBER)
  for (const org of [lerato, darajani, agape]) {
    await prisma.approvalRule.createMany({
      data: [
        {
          organizationId: org.id,
          thresholdAmount: 0,
          requiredApprovers: 1,
          requiredRoles: ["FINANCE_LEAD", "ADMIN"],
        },
        {
          organizationId: org.id,
          thresholdAmount: 50000,
          requiredApprovers: 2,
          requiredRoles: ["FINANCE_LEAD", "ADMIN"],
        },
        {
          organizationId: org.id,
          thresholdAmount: 250000,
          requiredApprovers: 3,
          requiredRoles: ["FINANCE_LEAD", "ADMIN", "BOARD_MEMBER"],
        },
      ],
      skipDuplicates: true,
    });
  }
  console.log("  ✓ Approval rules seeded for all 3 orgs (0 / 50K / 250K tiers)");

  // ──────────────────────────────────────────────────────────────────
  // REPORTS — dummy reports per org (skip if already seeded)
  // ──────────────────────────────────────────────────────────────────
  const reportCount = await prisma.report.count({ where: { organizationId: lerato.id, generatedBy: "seed" } });
  if (reportCount === 0) {
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearEnd = new Date(new Date().getFullYear(), 11, 31);

    await prisma.report.createMany({
      data: [
        // Lerato reports
        { organizationId: lerato.id, type: ReportType.BOARD_QUARTERLY, title: "Q1 2026 Board Report — Lerato Foundation", periodStart: yearStart, periodEnd: threeMonthsAgo, status: "FINAL", generatedBy: "seed", recipients: ["board@leratofoundation.org"] },
        { organizationId: lerato.id, type: ReportType.DONOR_ANNUAL, title: "Annual Donor Report 2025 — Lerato Foundation", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), status: "FINAL", generatedBy: "seed", recipients: ["donors@leratofoundation.org"] },
        { organizationId: lerato.id, type: ReportType.GRANT_FUNDER, title: "Grant Utilisation Report — Q4 2025", periodStart: new Date("2025-10-01"), periodEnd: new Date("2025-12-31"), status: "SUBMITTED", generatedBy: "seed", recipients: ["grants@leratofoundation.org"] },
        { organizationId: lerato.id, type: ReportType.INTERNAL, title: "Programme Delivery Review — May 2026", periodStart: oneMonthAgo, periodEnd: new Date(), status: "DRAFT", generatedBy: "seed", recipients: [] },
        // Darajani reports
        { organizationId: darajani.id, type: ReportType.FKF_COMPLIANCE, title: "FKF Compliance Report — Season 2025/26", periodStart: new Date("2025-08-01"), periodEnd: new Date("2026-05-31"), status: "SUBMITTED", generatedBy: "seed", recipients: ["fkf@darajani.co.ke"] },
        { organizationId: darajani.id, type: ReportType.BOARD_QUARTERLY, title: "Q2 2026 Academy Board Report", periodStart: threeMonthsAgo, periodEnd: new Date(), status: "DRAFT", generatedBy: "seed", recipients: ["board@darajani.co.ke"] },
        { organizationId: darajani.id, type: ReportType.INTERNAL, title: "Player Development Report — Mid-Season", periodStart: sixMonthsAgo, periodEnd: new Date(), status: "FINAL", generatedBy: "seed", recipients: [] },
        // Agape reports
        { organizationId: agape.id, type: ReportType.REGULATOR, title: "NGO Regulatory Report 2025 — Agape in Action", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), status: "SUBMITTED", generatedBy: "seed", recipients: ["compliance@agapeinaction.org"] },
        { organizationId: agape.id, type: ReportType.DONOR_ANNUAL, title: "Donor Impact Report 2025", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), status: "FINAL", generatedBy: "seed", recipients: ["info@agapeinaction.org"] },
      ],
    });
    console.log("  ✓ 9 dummy reports seeded");
  } else {
    console.log("  ↷ Reports already seeded, skipping");
  }

  // ──────────────────────────────────────────────────────────────────
  // COMMUNICATIONS — dummy messages per org
  // ──────────────────────────────────────────────────────────────────
  const commCount = await prisma.communication.count({ where: { organizationId: darajani.id, createdBy: "seed" } });
  if (commCount === 0) {
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

    await prisma.communication.createMany({
      data: [
        // Darajani comms
        {
          organizationId: darajani.id, type: CommType.SMS, subject: "Training Schedule — July 2026",
          body: "Dear Parent/Guardian, training sessions for July 2026 will be held every Tuesday and Thursday from 4:00 PM to 6:00 PM at Mwiki Ground. Please ensure your child arrives on time with appropriate kit. — Darajani Academy",
          status: "SENT", sentAt: oneWeekAgo, recipientCount: 48, successCount: 46, failureCount: 2, createdBy: "seed",
        },
        {
          organizationId: darajani.id, type: CommType.WHATSAPP, subject: "Tournament Notice — Nairobi Cup",
          body: "Congratulations to our U-17 squad! We have qualified for the Nairobi Cup Regional Finals on 5 July 2026. All selected players must attend the mandatory briefing on Thursday 1 July at 5 PM. Parents encouraged to attend. Go Darajani!",
          status: "SENT", sentAt: twoWeeksAgo, recipientCount: 22, successCount: 22, failureCount: 0, createdBy: "seed",
        },
        {
          organizationId: darajani.id, type: CommType.EMAIL, subject: "Kit Collection — New Season",
          body: "Dear Academy Families,\n\nWe are pleased to announce that new season kits are ready for collection. Pick-up will be at the Academy office every weekday from 8 AM to 12 PM during the week of 23–27 June 2026.\n\nPlease bring your player ID card.\n\nBest regards,\nDarajani Sports Academy",
          status: "SENT", sentAt: yesterday, recipientCount: 62, successCount: 60, failureCount: 2, createdBy: "seed",
        },
        {
          organizationId: darajani.id, type: CommType.INTERNAL_ANNOUNCEMENT, subject: "Staff Meeting — 25 June 2026",
          body: "All coaching and administrative staff: please note our monthly review meeting is scheduled for Wednesday 25 June at 10:00 AM in the main conference room. Agenda: season review, budget Q3, FIFA compliance update. Attendance mandatory.",
          status: "SENT", sentAt: new Date(), recipientCount: 8, successCount: 8, failureCount: 0, createdBy: "seed",
        },
        // Lerato comms
        {
          organizationId: lerato.id, type: CommType.EMAIL, subject: "Scholarship Recipients — June 2026",
          body: "Dear Donors and Friends,\n\nWe are delighted to share that 12 new scholarship recipients have been enrolled in our Education Support Programme for the 2026 academic year. Each student will receive full school fees, stationery, and mentorship support.\n\nThank you for making this possible.\n\nWith gratitude,\nLerato Foundation",
          status: "SENT", sentAt: twoWeeksAgo, recipientCount: 34, successCount: 34, failureCount: 0, createdBy: "seed",
        },
        {
          organizationId: lerato.id, type: CommType.SMS, subject: "Community Day — 28 June",
          body: "You are invited to Lerato Foundation Community Day on 28 June 2026 at Kibwezi West Hub. Free meals, talent showcase, and community sharing. Bring your family. Starts 9 AM. RSVP: +254743838384",
          status: "SENT", sentAt: oneWeekAgo, recipientCount: 150, successCount: 147, failureCount: 3, createdBy: "seed",
        },
        // Agape comms
        {
          organizationId: agape.id, type: CommType.EMAIL, subject: "Mission Update — World Cup Engagement Programme",
          body: "Dear Delegates and Supporters,\n\nThe World Cup Engagement Programme departure has been confirmed for 7 July 2026. All delegates must complete visa processing by 25 June. Please ensure all documentation is submitted to the mission office by COB Friday 20 June.\n\nIn faith and mission,\nAgape in Action",
          status: "SENT", sentAt: twoWeeksAgo, recipientCount: 12, successCount: 12, failureCount: 0, createdBy: "seed",
        },
        {
          organizationId: agape.id, type: CommType.WHATSAPP, subject: "Prayer Focus — June 2026",
          body: "Shalom Family 🙏 Our June prayer focus is the upcoming World Cup mission. Please keep the delegation in your prayers. Key dates: Final briefing 1 July, Departure 7 July. Thank you for your continued support and intercession.",
          status: "SENT", sentAt: yesterday, recipientCount: 75, successCount: 73, failureCount: 2, createdBy: "seed",
        },
        // Draft
        {
          organizationId: lerato.id, type: CommType.EMAIL, subject: "Q3 Newsletter — Draft",
          body: "DRAFT — Lerato Foundation Q3 2026 Newsletter. Sections: Programme updates, Finance summary, Upcoming events, Volunteer spotlight. To be finalised by communications team before send.",
          status: "DRAFT", sentAt: null, recipientCount: 0, successCount: 0, failureCount: 0, createdBy: "seed",
        },
      ],
    });
    console.log("  ✓ 9 dummy communications seeded");
  } else {
    console.log("  ↷ Communications already seeded, skipping");
  }

  // ──────────────────────────────────────────────────────────────────
  // AUDIT LOGS — activity trail across all orgs
  // ──────────────────────────────────────────────────────────────────
  const logCount = await prisma.auditLog.count({ where: { actorId: victor.id } });
  if (logCount === 0) {
    const d = (daysAgo: number) => { const dt = new Date(); dt.setDate(dt.getDate() - daysAgo); return dt; };

    await prisma.auditLog.createMany({
      data: [
        // Login events
        { organizationId: lerato.id, actorId: victor.id, action: "LOGIN", entity: "Session", createdAt: d(14) },
        { organizationId: darajani.id, actorId: victor.id, action: "LOGIN", entity: "Session", createdAt: d(7) },
        { organizationId: agape.id, actorId: victor.id, action: "LOGIN", entity: "Session", createdAt: d(3) },
        { organizationId: lerato.id, actorId: simon.id, action: "LOGIN", entity: "Session", createdAt: d(10) },
        { organizationId: agape.id, actorId: martha.id, action: "LOGIN", entity: "Session", createdAt: d(5) },
        // Beneficiary actions
        { organizationId: darajani.id, actorId: victor.id, action: "CREATE", entity: "Beneficiary", entityId: "seed-ben-001", after: { firstName: "Test", lastName: "Athlete" } as any, createdAt: d(30) },
        { organizationId: darajani.id, actorId: victor.id, action: "UPDATE", entity: "Beneficiary", entityId: "seed-ben-001", before: { jerseyNumber: null } as any, after: { jerseyNumber: 10 } as any, createdAt: d(25) },
        { organizationId: lerato.id, actorId: simon.id, action: "CREATE", entity: "Beneficiary", entityId: "seed-ben-002", after: { firstName: "Test", lastName: "Student" } as any, createdAt: d(20) },
        // Finance actions
        { organizationId: lerato.id, actorId: victor.id, action: "CREATE", entity: "Transaction", entityId: "seed-tx-001", after: { type: "INCOME", amount: 250000, description: "Grant — Q1 2026" } as any, createdAt: d(45) },
        { organizationId: lerato.id, actorId: simon.id, action: "CREATE", entity: "Transaction", entityId: "seed-tx-002", after: { type: "EXPENSE", amount: 85000, description: "Programme delivery — May 2026" } as any, createdAt: d(28) },
        { organizationId: darajani.id, actorId: victor.id, action: "CREATE", entity: "Transaction", entityId: "seed-tx-003", after: { type: "INCOME", amount: 150000, description: "Kit sponsorship" } as any, createdAt: d(35) },
        // Donor actions
        { organizationId: lerato.id, actorId: victor.id, action: "CREATE", entity: "Donor", entityId: "seed-dn-001", after: { firstName: "Dummy", lastName: "Donor" } as any, createdAt: d(60) },
        { organizationId: lerato.id, actorId: simon.id, action: "CREATE", entity: "Donation", entityId: "seed-don-001", after: { amount: 50000, channel: "BANK_TRANSFER" } as any, createdAt: d(55) },
        // Report actions
        { organizationId: lerato.id, actorId: victor.id, action: "EXPORT", entity: "Report", entityId: "seed-rpt-001", after: { type: "DONOR_ANNUAL", format: "PDF" } as any, createdAt: d(8) },
        { organizationId: darajani.id, actorId: victor.id, action: "EXPORT", entity: "Report", entityId: "seed-rpt-002", after: { type: "FKF_COMPLIANCE", format: "PDF" } as any, createdAt: d(4) },
        // Mission / event
        { organizationId: agape.id, actorId: martha.id, action: "UPDATE", entity: "Mission", entityId: "seed-mis-001", before: { status: "PLANNING" } as any, after: { status: "CONFIRMED" } as any, createdAt: d(12) },
        { organizationId: darajani.id, actorId: victor.id, action: "CREATE", entity: "Event", entityId: "seed-ev-001", after: { name: "Nairobi Cup Regional Finals", type: "TOURNAMENT" } as any, createdAt: d(18) },
        // User management
        { organizationId: lerato.id, actorId: victor.id, action: "CREATE", entity: "Membership", entityId: "seed-mem-001", after: { role: "FINANCE", email: "finance@leratofoundation.org" } as any, createdAt: d(90) },
      ],
    });
    console.log("  ✓ 19 audit log entries seeded");
  } else {
    console.log("  ↷ Audit logs already seeded, skipping");
  }

  // ──────────────────────────────────────────────────────────────────
  // CHART OF ACCOUNTS
  // ──────────────────────────────────────────────────────────────────
  const accountCount = await prisma.account.count({ where: { isSystem: true } });
  if (accountCount === 0) {
    async function seedAccounts(orgId: string, bankName: string) {
      type AcctDef = { code: string; name: string; type: AccountType; subtype?: string; description?: string; parentCode?: string; isRestricted?: boolean };
      const defs: AcctDef[] = [
        // ASSETS
        { code: "1000", name: "Cash & Cash Equivalents",     type: AccountType.ASSET, subtype: "CASH",    description: "All liquid cash and near-cash holdings" },
        { code: "1010", name: "Petty Cash",                  type: AccountType.ASSET, subtype: "CASH",    parentCode: "1000" },
        { code: "1020", name: "M-PESA Float",                type: AccountType.ASSET, subtype: "MPESA",   parentCode: "1000", description: "Safaricom M-PESA business account" },
        { code: "1030", name: `${bankName} — Current`,       type: AccountType.ASSET, subtype: "BANK",    parentCode: "1000" },
        { code: "1040", name: `${bankName} — Savings`,       type: AccountType.ASSET, subtype: "BANK",    parentCode: "1000" },
        { code: "1100", name: "Accounts Receivable",         type: AccountType.ASSET, subtype: "RECEIVABLE", description: "Pledged but not yet received funds" },
        // LIABILITIES
        { code: "2000", name: "Current Liabilities",         type: AccountType.LIABILITY, description: "Short-term obligations" },
        { code: "2010", name: "Accounts Payable",            type: AccountType.LIABILITY, subtype: "PAYABLE",    parentCode: "2000" },
        { code: "2020", name: "Accrued Expenses",            type: AccountType.LIABILITY, parentCode: "2000",    description: "Expenses incurred but not yet paid" },
        { code: "2030", name: "Deferred Income",             type: AccountType.LIABILITY, subtype: "RESTRICTED", parentCode: "2000", description: "Grants received but conditions not yet met", isRestricted: true },
        // EQUITY / NET ASSETS
        { code: "3000", name: "Net Assets",                  type: AccountType.EQUITY,  description: "Total organisational net worth" },
        { code: "3010", name: "Unrestricted Net Assets",     type: AccountType.EQUITY,  subtype: "UNRESTRICTED", parentCode: "3000" },
        { code: "3020", name: "Temporarily Restricted",      type: AccountType.EQUITY,  subtype: "RESTRICTED",   parentCode: "3000", isRestricted: true, description: "Donor-restricted funds with time/purpose limits" },
        // INCOME
        { code: "4000", name: "Revenue",                     type: AccountType.INCOME,  description: "All income streams" },
        { code: "4010", name: "Donations — General",         type: AccountType.INCOME,  parentCode: "4000" },
        { code: "4020", name: "Grants — Government",         type: AccountType.INCOME,  parentCode: "4000" },
        { code: "4030", name: "Grants — International",      type: AccountType.INCOME,  parentCode: "4000" },
        { code: "4040", name: "Programme Fees",              type: AccountType.INCOME,  parentCode: "4000" },
        { code: "4050", name: "Event Income",                type: AccountType.INCOME,  parentCode: "4000" },
        { code: "4060", name: "Gift in Kind",                type: AccountType.INCOME,  parentCode: "4000", description: "Non-cash donations valued at fair market price" },
        // EXPENSES
        { code: "5000", name: "Operating Expenses",          type: AccountType.EXPENSE, description: "All organisational expenditure" },
        { code: "5010", name: "Salaries & Benefits",         type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5020", name: "Programme Costs",             type: AccountType.EXPENSE, parentCode: "5000", description: "Direct costs of delivering programmes" },
        { code: "5030", name: "Travel & Transport",          type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5040", name: "Equipment & Supplies",        type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5050", name: "Communications",              type: AccountType.EXPENSE, parentCode: "5000", description: "Phone, internet, SMS, postal" },
        { code: "5060", name: "Rent & Utilities",            type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5070", name: "Professional Services",       type: AccountType.EXPENSE, parentCode: "5000", description: "Legal, audit, consultancy fees" },
        { code: "5080", name: "Training & Capacity Building",type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5090", name: "Monitoring & Evaluation",     type: AccountType.EXPENSE, parentCode: "5000" },
        { code: "5100", name: "Contingency",                 type: AccountType.EXPENSE, parentCode: "5000", description: "Reserve for unforeseen expenses" },
      ];

      // Build code→id map for parent linking
      const codeToId = new Map<string, string>();

      for (const def of defs) {
        const parentId = def.parentCode ? codeToId.get(def.parentCode) : undefined;
        const acct = await prisma.account.upsert({
          where: { organizationId_code: { organizationId: orgId, code: def.code } },
          update: {},
          create: {
            organizationId: orgId,
            code: def.code,
            name: def.name,
            type: def.type,
            subtype: def.subtype ?? null,
            description: def.description ?? null,
            parentId: parentId ?? null,
            isRestricted: def.isRestricted ?? false,
            isSystem: true,
          },
        });
        codeToId.set(def.code, acct.id);
      }
    }

    await seedAccounts(lerato.id, "Equity Bank");
    await seedAccounts(darajani.id, "KCB");
    await seedAccounts(agape.id, "Co-operative Bank");
    console.log("  ✓ Chart of accounts seeded (31 accounts × 3 orgs)");
  } else {
    console.log("  ↷ Chart of accounts already seeded, skipping");
  }

  console.log("\n✅ Seed complete. Initial credentials:");
  console.log("   victor@victormuoki.com / change-me-on-first-login");
  console.log("   simon@leratofoundation.org / change-me-on-first-login");
  console.log("   martha@agapeinaction.org / change-me-on-first-login");
}

main()
  .then(async () => { await prisma.$disconnect(); await pool.end(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });

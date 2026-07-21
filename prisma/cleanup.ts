/**
 * Lerato Platform — Test Data Cleanup
 *
 * Removes all dummy/test data while preserving:
 *   - Organizations (lerato, darajani, agape)
 *   - Users (Victor, Simon, Martha) and their memberships
 *   - Programs (6 real programs)
 *   - Partnerships (15 Lerato partnerships)
 *   - Missions + delegates (World Cup 2026)
 *   - Approval rules
 *   - Chart of Accounts (31 accounts × 3 orgs)
 *
 * Run with: npx tsx --env-file=.env prisma/cleanup.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("→ Lerato Platform — clearing test data...\n");

  // ── Beneficiary child records that use RESTRICT (no cascade) ──────
  // Must be deleted before deleting Beneficiary rows.

  const { count: taCount } = await prisma.trainingAttendance.deleteMany({});
  console.log(`  ✓ ${taCount} training attendance records removed`);

  const { count: attCount } = await prisma.attendance.deleteMany({});
  console.log(`  ✓ ${attCount} programme attendance records removed`);

  const { count: surveyCount } = await prisma.surveyResponse.deleteMany({});
  console.log(`  ✓ ${surveyCount} survey responses removed`);

  const { count: outcomeCount } = await prisma.outcome.deleteMany({});
  console.log(`  ✓ ${outcomeCount} outcomes removed`);

  const { count: enrolCount } = await prisma.programEnrolment.deleteMany({});
  console.log(`  ✓ ${enrolCount} programme enrolments removed`);

  // ── Beneficiaries (CASCADE: AthleteProfile, StudentProfile, ScoutReport)
  const { count: benCount } = await prisma.beneficiary.deleteMany({});
  console.log(`  ✓ ${benCount} beneficiaries removed (profiles & scout reports cascaded)`);

  // ── Training sessions (safe now that TrainingAttendance is gone)
  const { count: sessionCount } = await prisma.trainingSession.deleteMany({});
  console.log(`  ✓ ${sessionCount} training sessions removed`);

  // ── Journal lines → entries → transactions (order matters for FKs)
  const { count: lineCount } = await prisma.journalLine.deleteMany({});
  console.log(`  ✓ ${lineCount} journal lines removed`);

  const { count: jeCount } = await prisma.journalEntry.deleteMany({});
  console.log(`  ✓ ${jeCount} journal entries removed`);

  const { count: txCount } = await prisma.transaction.deleteMany({});
  console.log(`  ✓ ${txCount} transactions removed`);

  // ── Reset all account balances to zero
  const { count: acctCount } = await prisma.account.updateMany({
    data: { balance: 0 },
  });
  console.log(`  ✓ ${acctCount} account balances reset to 0`);

  // ── Fund allocations (CASCADE: Approval)
  const { count: allocCount } = await prisma.fundAllocation.deleteMany({});
  console.log(`  ✓ ${allocCount} fund allocations removed`);

  // ── HR — must delete LeaveRequest & PayrollRecord before StaffVolunteer
  const { count: leaveCount } = await prisma.leaveRequest.deleteMany({});
  console.log(`  ✓ ${leaveCount} leave requests removed`);

  const { count: payrollCount } = await prisma.payrollRecord.deleteMany({});
  console.log(`  ✓ ${payrollCount} payroll records removed`);

  const { count: staffCount } = await prisma.staffVolunteer.deleteMany({});
  console.log(`  ✓ ${staffCount} staff/volunteer records removed`);

  // ── Budgets & fixed assets
  const { count: budgetCount } = await prisma.budget.deleteMany({});
  console.log(`  ✓ ${budgetCount} budgets removed`);

  const { count: assetCount } = await prisma.fixedAsset.deleteMany({});
  console.log(`  ✓ ${assetCount} fixed assets removed`);

  // ── Procurement — PurchaseOrder before Vendor
  const { count: poCount } = await prisma.purchaseOrder.deleteMany({});
  console.log(`  ✓ ${poCount} purchase orders removed`);

  const { count: vendorCount } = await prisma.vendor.deleteMany({});
  console.log(`  ✓ ${vendorCount} vendors removed`);

  // ── Donors — Donation before Donor (RESTRICT FK), DonorShare cascades
  const { count: donationCount } = await prisma.donation.deleteMany({});
  console.log(`  ✓ ${donationCount} donations removed`);

  const { count: donorCount } = await prisma.donor.deleteMany({});
  console.log(`  ✓ ${donorCount} donors removed (shares cascaded)`);

  // ── Events
  const { count: eventCount } = await prisma.event.deleteMany({});
  console.log(`  ✓ ${eventCount} events removed`);

  // ── Seeded reports, comms, and audit logs
  const { count: reportCount } = await prisma.report.deleteMany({
    where: { generatedBy: "seed" },
  });
  console.log(`  ✓ ${reportCount} seed reports removed`);

  const { count: commCount } = await prisma.communication.deleteMany({
    where: { createdBy: "seed" },
  });
  console.log(`  ✓ ${commCount} seed communications removed`);

  const { count: logCount } = await prisma.auditLog.deleteMany({});
  console.log(`  ✓ ${logCount} audit log entries removed`);

  console.log("\n✅ Database is clean and ready for production.");
  console.log("   Preserved: orgs, users, memberships, programs, partnerships,");
  console.log("   mission + delegates, approval rules, Chart of Accounts.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });

const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL, {});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Darajani org ──────────────────────────────────────────────────────────
  const darajani = await prisma.organization.findFirst({ where: { slug: "darajani" } });

  await prisma.organization.update({
    where: { id: darajani.id },
    data: {
      description:
        "Darajani Sports Academy is a flagship youth sports development project of the Lerato Foundation, based in Kiserian, Kajiado County. " +
        "With 76 talented athletes aged 16–19 and a nationwide scouting programme, the academy is dedicated to nurturing potential, " +
        "fostering discipline, and shaping the leaders of tomorrow.",
      launchDate: new Date("2026-06-25"),
      county: "Kajiado",
      address: "Kiserian, Kajiado County, Kenya",
    },
  });
  console.log("✓ Darajani org updated");

  // ── Darajani Elite branch description ─────────────────────────────────────
  const elite = await prisma.branch.findFirst({
    where: { organizationId: darajani.id, name: "Darajani Elite" },
  });

  if (elite) {
    await prisma.branch.update({
      where: { id: elite.id },
      data: {
        description:
          "Darajani Elite is the Nairobi satellite hub of Darajani Sports Academy, based in Mwiki, Kasarani. " +
          "A high-performance identification and development centre, scouting raw talent from Nairobi and channelling " +
          "selected athletes into the main academy programme in Kiserian.",
      },
    });
    console.log("✓ Darajani Elite branch description updated");
  }

  // ── Official Launch event ─────────────────────────────────────────────────
  const existingLaunch = await prisma.event.findFirst({
    where: { organizationId: darajani.id, name: { contains: "Official Launch" } },
  });

  if (!existingLaunch) {
    await prisma.event.create({
      data: {
        organizationId: darajani.id,
        name: "Darajani Sports Academy — Official Launch",
        type: "COMMUNITY_DAY",
        description:
          "The official public launch of Darajani Sports Academy. Celebrating 76 athletes aged 16–19, " +
          "a nationwide scouting programme, and a milestone in youth empowerment and sports excellence in Kajiado County.",
        startsAt: new Date("2026-06-25T10:00:00.000Z"),
        endsAt:   new Date("2026-06-25T17:00:00.000Z"),
        venue: "Kiserian, Kajiado County, Kenya",
        status: "SCHEDULED",
        registrationOpen: false,
      },
    });
    console.log("✓ Official Launch event created (June 25, 2026)");
  } else {
    console.log("  Launch event already exists — skipped");
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const updated = await prisma.organization.findFirst({
    where: { slug: "darajani" },
    select: { name: true, description: true, launchDate: true, county: true },
  });
  console.log("\nDarajani org:", JSON.stringify(updated, null, 2));

  const updatedBranch = await prisma.branch.findFirst({
    where: { organizationId: darajani.id, name: "Darajani Elite" },
    select: { name: true, description: true },
  });
  console.log("Elite branch:", JSON.stringify(updatedBranch, null, 2));

  const events = await prisma.event.findMany({
    where: { organizationId: darajani.id },
    select: { title: true, startsAt: true, location: true },
  });
  console.log("Events:", JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

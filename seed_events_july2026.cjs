require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL, {});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Fetch org IDs
  const [darajani, lerato] = await Promise.all([
    prisma.organization.findFirst({ where: { slug: "darajani" }, select: { id: true, name: true } }),
    prisma.organization.findFirst({ where: { slug: "lerato"   }, select: { id: true, name: true } }),
  ]);

  if (!darajani) throw new Error("Darajani org not found");
  if (!lerato)   throw new Error("Lerato org not found");

  console.log(`Darajani: ${darajani.id}`);
  console.log(`Lerato:   ${lerato.id}`);

  const events = [
    // ── Darajani ──────────────────────────────────────────────────────
    {
      organizationId: darajani.id,
      name:        "Match vs Mpesa Foundation Academy",
      type:        "TOURNAMENT",
      description: "Competitive match between Darajani Elite and Mpesa Foundation Academy.",
      startsAt:    new Date("2026-07-12T09:00:00.000+03:00"),
      endsAt:      new Date("2026-07-12T17:00:00.000+03:00"),
      status:      "COMPLETED",
    },
    {
      organizationId: darajani.id,
      name:        "Field Assessment & Topology",
      type:        "OTHER",
      description: "Site visit, field assessment and topology mapping for Darajani Elite.",
      startsAt:    new Date("2026-07-03T09:00:00.000+03:00"),
      endsAt:      new Date("2026-07-03T18:00:00.000+03:00"),
      status:      "COMPLETED",
    },
    {
      organizationId: darajani.id,
      name:        "Training Session — 4th July",
      type:        "TRAINING_CAMP",
      description: "Darajani Elite training session.",
      startsAt:    new Date("2026-07-04T09:00:00.000+03:00"),
      endsAt:      new Date("2026-07-04T18:00:00.000+03:00"),
      status:      "COMPLETED",
    },
    // ── Lerato Foundation ─────────────────────────────────────────────
    {
      organizationId: lerato.id,
      name:        "Mentorship & Leadership Session",
      type:        "COMMUNITY_DAY",
      description: "Mentorship and leadership development session for programme participants.",
      startsAt:    new Date("2026-07-03T09:00:00.000+03:00"),
      endsAt:      new Date("2026-07-03T17:00:00.000+03:00"),
      status:      "COMPLETED",
    },
    {
      organizationId: lerato.id,
      name:        "Weekend Community Engagement — 27th June",
      type:        "COMMUNITY_DAY",
      description: "Weekend school and community engagement programme.",
      startsAt:    new Date("2026-06-27T09:00:00.000+03:00"),
      endsAt:      new Date("2026-06-28T17:00:00.000+03:00"),
      status:      "COMPLETED",
    },
  ];

  for (const evt of events) {
    // Check if a similar event already exists (same org + same date + similar name)
    const day   = new Date(evt.startsAt);
    day.setHours(0, 0, 0, 0);
    const next  = new Date(day);
    next.setDate(next.getDate() + 1);

    const existing = await prisma.event.findFirst({
      where: {
        organizationId: evt.organizationId,
        startsAt: { gte: day, lt: next },
        name: evt.name,
        deletedAt: null,
      },
    });

    if (existing) {
      console.log(`SKIP  already exists: "${evt.name}" (${existing.id})`);
    } else {
      const created = await prisma.event.create({ data: evt });
      console.log(`CREATE "${created.name}" → ${created.id}`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.partnership.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, partnerName: true, partnerType: true, createdAt: true },
  });

  console.log(`Total partnership records: ${all.length}`);

  // Group by (organizationId, partnerName, partnerType) — keep first (oldest), delete rest
  const seen = new Map();
  const toDelete = [];

  for (const p of all) {
    const key = `${p.organizationId}|${p.partnerName}|${p.partnerType}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.set(key, p.id);
    }
  }

  console.log(`Unique partners: ${seen.size}`);
  console.log(`Duplicates to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const result = await prisma.partnership.deleteMany({
    where: { id: { in: toDelete } },
  });

  console.log(`Deleted ${result.count} duplicate partnerships.`);

  const remaining = await prisma.partnership.count();
  console.log(`Remaining: ${remaining}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const agape = await prisma.organization.findFirst({ where: { slug: "agape" } });
  console.log("Agape org:", agape.id, agape.name);

  const missions = await prisma.mission.findMany({ where: { organizationId: agape.id } });
  console.log("Missions found:", missions.map(m => m.title));

  const deleted = await prisma.mission.deleteMany({ where: { organizationId: agape.id } });
  console.log("Deleted:", deleted.count, "mission(s)");
}

main().catch(console.error).finally(() => prisma.$disconnect());

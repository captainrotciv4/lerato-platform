const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deleted = await prisma.branch.deleteMany({
    where: { name: "Darajani Main Academy" }
  });
  console.log("Deleted:", deleted.count, "branch(es)");

  const branches = await prisma.branch.findMany({
    include: { organization: { select: { name: true } } }
  });
  console.log("Remaining:", JSON.stringify(branches.map(b => ({ name: b.name, org: b.organization.name, isMain: b.isMain })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

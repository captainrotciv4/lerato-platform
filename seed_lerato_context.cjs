const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL, {});
const prisma = new PrismaClient({ adapter });

async function main() {
  const lerato = await prisma.organization.findFirst({ where: { slug: "lerato" } });
  if (!lerato) { console.error("Lerato org not found"); return; }

  await prisma.organization.update({
    where: { id: lerato.id },
    data: {
      description:
        "Lerato Foundation is a Kenyan non-profit dedicated to transforming lives through sports, " +
        "education, and community mission. It is the parent body of Darajani Sports Academy — " +
        "a flagship youth sports development programme in Kajiado County — and Agape Mission, " +
        "its community outreach and humanitarian arm. Through these initiatives, Lerato invests " +
        "in Kenya's next generation of leaders, athletes, and changemakers.",
    },
  });
  console.log("✓ Lerato Foundation description updated");

  const agape = await prisma.organization.findFirst({ where: { slug: "agape" } });
  if (agape && !agape.description) {
    await prisma.organization.update({
      where: { id: agape.id },
      data: {
        description:
          "Agape Mission is the community outreach and humanitarian arm of the Lerato Foundation. " +
          "It mobilises volunteers and resources to serve vulnerable communities across Kenya " +
          "through medical camps, food distribution, discipleship, and skills training programmes.",
      },
    });
    console.log("✓ Agape Mission description updated");
  } else {
    console.log("  Agape already has a description — skipped");
  }

  const results = await prisma.organization.findMany({
    where: { slug: { in: ["lerato", "agape"] } },
    select: { slug: true, name: true, description: true },
  });
  console.log("\nResult:", JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

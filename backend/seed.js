const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.create({
    data: { name: 'Test Org' },
  });

  const proj = await prisma.project.create({
    data: { name: 'Test Project', organizationId: org.id },
  });

  await prisma.queue.create({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test Queue',
      projectId: proj.id,
    },
  });

  console.log('Database seeded with test queue!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import { createSpecialties } from './specialties';
import { createUsers } from './users';
import { createProjectTemplates } from './projects';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    console.error('This command cannot be run in this env!');
    return;
  }
  console.log('server.db.seed.start');
  await createUsers(prisma);
  await createProjectTemplates(prisma);
  await createSpecialties(prisma);
}

main()
  .then(async () => {
    console.log('server.db.seed.complete');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

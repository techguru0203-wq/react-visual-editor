import { specialtyData } from './specialtyData';
import { PrismaClient } from '@prisma/client';

export const createSpecialties = async (prisma: PrismaClient) => {
  console.log('server.db.seed.createSpecialities.start');

  const orgs = await prisma.specialty.createMany({
    data: specialtyData,
  });

  console.log('server.db.seed.createSpecialties.done');
};

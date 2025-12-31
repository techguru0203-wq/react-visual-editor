import { PrismaClient } from '@prisma/client';
import { orgsData } from './organizationsData';
import { teamsData, usersData, userTeamsData } from './userData';

export const createUsers = async (prisma: PrismaClient) => {
  console.log('server.db.seed.createUsers.start');

  const orgs = await prisma.organization.createMany({
    data: orgsData,
  });

  const teams = await prisma.team.createMany({
    data: teamsData,
  });

  const users = await prisma.user.createMany({
    data: usersData,
  });

  const userTeams = await prisma.userTeam.createMany({
    data: userTeamsData,
  });

  console.log('server.db.seed.createUsers.done');
};

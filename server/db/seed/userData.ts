import { Department, UserRole } from '@prisma/client';
import { OrganizationID } from './organizationsData';

export const teamsData = [
  {
    id: 'platform',
    name: 'platform',
    description: 'platform team',
    organizationId: OrganizationID.Willy,
  },
  {
    id: 'web',
    name: 'web',
    description: 'web team',
    organizationId: OrganizationID.Willy,
  },
  {
    id: 'backend',
    name: 'backend',
    description: 'backend team',
    organizationId: OrganizationID.Willy,
  },
];

export const usersData = [
  {
    id: 'superAdmin',
    email: 'superadmin@omniflow.team',
    username: 'SuperAdmin',
    firstname: 'Super',
    lastname: 'Admin',
    department: <Department>'Product',
    role: <UserRole>'SUPERADMIN',
    organizationId: OrganizationID.SuperAdmin,
  },
  {
    id: 'willyAdmin',
    email: 'willyadmin@omniflow.team',
    username: 'willyAdmin',
    firstname: 'Willy',
    lastname: 'Admin',
    department: <Department>'Product',
    role: <UserRole>'ADMIN',
    organizationId: OrganizationID.Willy,
  },
  {
    id: 'sarahCorner',
    email: 'sarah.corner@omniflow.team',
    username: 'sarahcorner',
    firstname: 'Sarah',
    lastname: 'Corner',
    department: <Department>'Product',
    role: <UserRole>'EMPLOYEE',
    organizationId: OrganizationID.Willy,
  },
  {
    id: 'jimCollins',
    email: 'jim.collins@omniflow.team',
    username: 'jimcollins',
    firstname: 'Jim',
    lastname: 'Collins',
    department: <Department>'Engineering',
    role: <UserRole>'EMPLOYEE',
    organizationId: OrganizationID.Willy,
  },
  {
    id: 'mikeJohnson',
    email: 'mike.johson@omniflow.team',
    username: 'mike.johnson',
    firstname: 'Mike',
    lastname: 'Johnson',
    department: <Department>'Sales',
    role: <UserRole>'EMPLOYEE',
    organizationId: OrganizationID.Willy,
  },
];

export const userTeamsData = [
  {
    userId: 'sarahCorner',
    teamId: 'platform',
  },
  {
    userId: 'jimCollins',
    teamId: 'web',
  },
  {
    userId: 'mikeJohnson',
    teamId: 'backend',
  },
];

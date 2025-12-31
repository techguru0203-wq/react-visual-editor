export const OrganizationID = {
  SuperAdmin: 'superAdminCompany',
  Willy: process.env.NODE_ENV === 'development' ? 'willyCo' : 'willyCompany',
  Test: 'e2neie36zk16ggubgesxslye',
  Demo: 'thrk41rlo8wmd1k8ym03ycmc',
};

export const orgsData = [
  {
    id: OrganizationID.SuperAdmin,
    name: 'Super Admin Company',
    description: 'super admin Co.',
  },
  {
    id: OrganizationID.Willy,
    name: 'willy.Co',
    description: 'Willy.co company',
  },
  {
    id: OrganizationID.Test,
    name: 'Test',
    description: 'organization for testing purposes',
  },
  {
    id: OrganizationID.Demo,
    name: 'Demo',
    description: 'for demo projects',
  },
];

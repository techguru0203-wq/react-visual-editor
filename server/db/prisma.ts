import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
  // log: ['query'],
}).$extends({
  query: {
    issue: {
      async create({ args, query }) {
        args.data.changeHistory = {
          create: [
            {
              userId: args.data.creatorUserId || '',
              modifiedAttribute: JSON.stringify(args.data),
            },
          ],
        };
        return query(args);
      },
    },
  },
});

export default prisma;

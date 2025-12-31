import { User } from '@prisma/client';

import { ChatSession } from '@prisma/client';

export type ChatSessionOutput = Readonly<
  ChatSession & {
    user: Partial<User> | null;
  }
>;

import { ChatSession, User } from '@prisma/client';

// Copied from /server/routes/types/chatTypes.ts
export type ChatSessionOutput = Readonly<
  ChatSession & {
    user: Partial<User> | null;
  }
>;

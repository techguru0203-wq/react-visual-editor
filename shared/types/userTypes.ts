import { Department, Prisma, RecordStatus } from '@prisma/client';

export type UserOutput = Readonly<{
  id: string;
  organizationId: string;
  email: string;
  firstname: string;
  lastname: string;
  username: string;
  department?: Department | null;
  specialty?: string | null;
  velocity?: number | null;
  status: RecordStatus;
  meta: Prisma.JsonValue;
  jiraEnabled: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

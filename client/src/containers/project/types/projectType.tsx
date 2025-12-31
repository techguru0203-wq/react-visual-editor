import { DOCTYPE, Document } from '@prisma/client';
import dayjs from 'dayjs';

// Copied from /server/routes/types/documentTypes.ts
export type DocumentOutput = Readonly<
  Omit<Document, 'content' | 'type'> & {
    type: Exclude<DOCTYPE, typeof DOCTYPE.DEVELOPMENT_PLAN>;
    contents?: string;
  }
>;

export type LegacyDocumentOutput = Readonly<
  Omit<Document, 'content'> & {
    contentStr: string;
    chatSessionId: string;
  }
>;

export type RefinementGenerationInput = Readonly<{
  paragraphBefore: string;
  paragraphAfter: string;
  userInput: string;
  selection: string;
  docId: string;
}>;
export type RefinementGenerationOutput = Readonly<{ contentStr: string }>;
// End copied code

export interface IIssueForm {
  id?: string;
  name: string;
  description: string;
  storyPoint: string;
  parentIssueId?: string;
  completedStoryPoint: string;
  plannedStartDate: string | dayjs.Dayjs;
  plannedEndDate: string | dayjs.Dayjs;
  type: string;
  status: string;
  workPlanId: string;
  creatorUserId: string;
  ownerUserId: string;
  sprintSelection?: string;
}

export enum IssueBuildableTypes {
  PRD = 'PRD',
  UIDESIGN = 'UI Design',
  PROTOTYPE = 'Prototype',
  TECHDESIGN = 'Technical Design',
  DEVELOPMENT = 'Development Plan',
  QA = 'QA',
  RELEASE = 'Release',
  PROPOSAL = 'Business Proposal',
}

export type DeleteBuildableArgs = Readonly<{
  projectId: string;
  buildableIssueId: string;
}>;

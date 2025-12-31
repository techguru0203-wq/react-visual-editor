import {
  Issue,
  Organization,
  Project,
  Specialty,
  Team,
  User,
  WorkPlan,
} from '@prisma/client';

type DocumentPreview = Readonly<{
  id: string;
  type: string;
  meta: any;
  url: string;
}>;

export type PaginationInfo = Readonly<{
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}>;

// Copied from /server/routes/types/organizationTypes.ts
export type OrganizationWithContents = Readonly<
  Organization & {
    users: ReadonlyArray<Readonly<User>>;
    teams: ReadonlyArray<
      Readonly<
        Team & {
          _count: Readonly<{
            childTeams: number;
            members: number;
            projects: number;
          }>;
        }
      >
    >;
    projects: OrganizationWithContentsProjects;
    specialties: ReadonlyArray<Readonly<Specialty>>;
    pagination?: PaginationInfo;
  }
>;

export type OrganizationWithContentsProjects = ReadonlyArray<
  Readonly<
    Project & {
      owner: Readonly<User>;
      issues: ReadonlyArray<Readonly<Issue>>;
      workPlans: ReadonlyArray<Readonly<WorkPlan>>;
      documents?: ReadonlyArray<DocumentPreview>;
    }
  >
>;

type Hierarchy<T> = Readonly<
  T & {
    projects: ReadonlyArray<Readonly<Project>>;
    teams: ReadonlyArray<Hierarchy<Team>>;
  }
>;

export type TeamHierarchy = Hierarchy<Team>;
export type OrganizationHierarchy = Hierarchy<Organization>;

export type TeamAndProjects = Readonly<
  Team & {
    projects: ReadonlyArray<Readonly<Project>>;
  }
>;
// End copied code

export type GetOrganizaionUsersArgs = Readonly<{
  excludeTeamId?: string | null;
}>;

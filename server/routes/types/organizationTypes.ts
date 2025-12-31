import {
  Issue,
  Organization,
  Project,
  Specialty,
  Team,
  User,
  WorkPlan,
} from '@prisma/client';

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
  }
>;

export type OrganizationWithContentsProjects = ReadonlyArray<
  Readonly<
    Project & {
      owner: Readonly<User>;
      issues: ReadonlyArray<Readonly<Issue>>;
      workPlans: ReadonlyArray<Readonly<WorkPlan>>;
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

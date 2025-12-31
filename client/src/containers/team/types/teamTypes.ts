import { Issue, Project, Team, User, UserTeam, WorkPlan } from '@prisma/client';

// Copied from /server/routes/types/teamTypes.ts
export type TeamOutput = Readonly<
  Team & {
    childTeams: ReadonlyArray<Readonly<Team>>;
    members: ReadonlyArray<
      Readonly<
        UserTeam & {
          user: Readonly<User>;
        }
      >
    >;
    projects: ReadonlyArray<
      Readonly<
        Project & {
          issues: ReadonlyArray<Readonly<Issue>>;
          workPlans: ReadonlyArray<Readonly<WorkPlan>>;
          owner: Readonly<User>;
        }
      >
    >;
  }
>;

export type TeamWithCounts = Readonly<
  Team & {
    _count: Readonly<{
      childTeams: number;
      members: number;
      projects: number;
    }>;
  }
>;

export type TeamMember = Readonly<
  UserTeam & {
    user: Readonly<User>;
  }
>;
// End copied code

export type CreateTeamArgs = Readonly<{
  name: string;
  parentTeamId?: string;
  description?: string;
  members?: ReadonlyArray<string>;
}>;

export type UpdateTeamArgs = Readonly<{
  teamId: string;
  name?: string;
  description?: string;
}>;

export type AddUserToTeamArgs = Readonly<{
  teamId: string;
  userId: string;
}>;

export type GetOrganizationOrTeamUsers =
  | Readonly<{ source: 'team'; teamId?: string | null }>
  | Readonly<{ source: 'organization'; excludeTeamId?: string | null }>;

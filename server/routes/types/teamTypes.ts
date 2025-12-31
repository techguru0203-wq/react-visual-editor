import {
    Access,
    Issue,
    Prisma,
    Project,
    ProjectStatus,
    RecordStatus,
    Team,
    User,
    UserTeam,
    WorkPlan,
} from '@prisma/client';
import { z } from 'zod';

export function getVisibleTeamsWhereClause(
  isAdmin: boolean = false,
  currentUserId: string
): Prisma.TeamWhereInput {
  console.log(
    'in server.routes.types.teamTypes.getVisibleTeamsWhereClause.isAdmin:',
    isAdmin
  );
  if (isAdmin) {
    return {
      status: RecordStatus.ACTIVE,
      members: {
        some: {
          status: RecordStatus.ACTIVE,
        },
      },
    };
  } else {
    return {
      status: RecordStatus.ACTIVE,
      members: {
        some: {
          userId: currentUserId,
          status: RecordStatus.ACTIVE,
        },
      },
    };
  }
}

export function getVisibleProjectsWhereClause(
  isAdmin: boolean = false,
  currentUserId: string
): Prisma.ProjectWhereInput {
  if (isAdmin) {
    return {
      status: {
        in: [
          ProjectStatus.CREATED,
          ProjectStatus.STARTED,
          ProjectStatus.PAUSED,
        ],
      },
      teamId: null,
    };
  } else {
    return {
      OR: [{ creatorUserId: currentUserId }, { access: Access.ORGANIZATION }],
      teamId: null,
      status: {
        in: [
          ProjectStatus.CREATED,
          ProjectStatus.STARTED,
          ProjectStatus.PAUSED,
        ],
      },
    };
  }
}

export const VisibleTeamMembers: Prisma.UserTeamWhereInput = {
  status: RecordStatus.ACTIVE,
};

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
          owner: Readonly<User> | null;
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

export const CreateTeamInputSchema = z.object({
  parentTeamId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  members: z.array(z.string()).nullable().optional(),
});

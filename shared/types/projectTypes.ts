import {
  Access,
  Document,
  DocumentPermissionTypes,
  Issue,
  Project,
  Team,
  User,
  UserTeam,
  WorkPlan,
} from '@prisma/client';
import { z } from 'zod';

export type ProjectTask = Readonly<Issue>;

export type ProjectStory = Readonly<Issue> &
  Readonly<{
    tasks: ReadonlyArray<ProjectTask>;
  }>;

export type IssueOutput = Readonly<Issue> &
  Readonly<{
    owner?: User | null;
    childIssues?: Issue[];
  }>;

export type ProjectEpic = Readonly<Issue> &
  Readonly<{
    stories: ReadonlyArray<ProjectStory>;
  }>;

export type ProjectSprintStory = ProjectStory &
  Readonly<{
    totalStoryPoint?: number | null;
    totalCompletedStoryPoint?: number | null;
    totalProgress?: number | null;
  }>;

export type ProjectSprint = Readonly<WorkPlan> &
  Readonly<{
    stories: ReadonlyArray<ProjectSprintStory>;
  }>;

export type ProjectMilestone = Readonly<WorkPlan> &
  Readonly<{
    epics: ReadonlyArray<ProjectEpic>;
    sprints: ReadonlyArray<ProjectSprint>;
  }>;

export type ProjectBacklog = Readonly<WorkPlan> &
  Readonly<{
    stories: ReadonlyArray<ProjectStory>;
    tasks: ReadonlyArray<ProjectTask>;
  }>;

export type BacklogOutput = IssueOutput[];

export type ProjectBuildable = Readonly<Issue> &
  Readonly<{
    owner?: User | null;
  }>;

export type Sprint = Readonly<WorkPlan> &
  Readonly<{
    issues?: IssueOutput[];
  }>;

export type SprintStatusMap = { [key: string]: Issue[] };

export type ProjectOutput = Readonly<Project> &
  Readonly<{
    documents: ReadonlyArray<Readonly<Document>>;
    creator: Readonly<User>;
    owner: Readonly<User> | null;
    team?:
      | (Readonly<Team> &
          Readonly<{
            members: ReadonlyArray<
              Readonly<UserTeam> &
                Readonly<{
                  user: Readonly<User>;
                }>
            >;
          }>)
      | null;
    buildables: ReadonlyArray<ProjectBuildable>;
    backlog?: ProjectBacklog | null;
    backlogIssues: BacklogOutput | [];
    backlogId?: string;
    milestones: ReadonlyArray<ProjectMilestone>;
    sprints: ReadonlyArray<Sprint> | [];
    activeSprintInd: number;
    issues: ReadonlyArray<IssueOutput>;
    shortName: string;
  }>;

export const UpdateProjectInputSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  access: z.nativeEnum(Access),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  access: z.nativeEnum(Access),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export type ProjectInfo = {
  name: string;
  id: string;
  jira_key: string;
};

export type ProjectAccessResponse = {
  hasAccess: boolean;
  projectPermission: DocumentPermissionTypes | null;
};

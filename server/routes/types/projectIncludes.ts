import { IssueStatus, Prisma, ProjectStatus, WorkPlanType } from "@prisma/client";

export const VisibleProjects: Prisma.ProjectWhereInput = {
  status: {
    in: [ProjectStatus.CREATED, ProjectStatus.STARTED, ProjectStatus.PAUSED],
  },
};

export const MilestonesAndBacklog: Prisma.WorkPlanWhereInput = {
  type: { in: [WorkPlanType.MILESTONE, WorkPlanType.BACKLOG] },
  status: { in: [IssueStatus.CREATED, IssueStatus.STARTED, IssueStatus.COMPLETED] },
}

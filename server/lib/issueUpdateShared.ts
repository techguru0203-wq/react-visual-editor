import { Issue, IssueStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { Response } from 'express';
import { updateParentIssueProgress } from '../services/issueService';
import { updateParentWorkplanProgress } from '../services/sprintService';
import { updateProjectStoryPointProgress } from '../services/projectService';
import { AuthenticatedUserWithProfile } from '../types/authTypes';

export const updateParentIssue = async (
  currentUser: AuthenticatedUserWithProfile,
  issueData: Issue,
  res: Response
) => {
  const issue = await prisma.issue.findUnique({
    where: {
      id: issueData.id,
    },
  });

  if (!issue) {
    console.log(
      "in server.routes.api.issues.update: issue doesn't exist",
      issueData
    );
    res
      .status(500)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }

  let statusCategory = (status: IssueStatus) => {
    if (status === IssueStatus.COMPLETED) {
      return 'COMPLETE';
    } else if (
      status === IssueStatus.CANCELED ||
      status === IssueStatus.OVERWRITTEN
    ) {
      return 'CANCEL';
    } else {
      return 'NORMAL';
    }
  };
  let action = '';
  let storyPointChange = 0;
  let oldStatus = statusCategory(issue.status);

  if (
    issueData.hasOwnProperty('storyPoint') &&
    issueData.storyPoint !== issue.storyPoint
  ) {
    storyPointChange = (issueData.storyPoint ?? 0) - (issue.storyPoint || 0);
  }
  if (issueData.hasOwnProperty('status') && issueData.status !== oldStatus) {
    // status changed
    // don't allow story point change now
    if (storyPointChange !== 0) {
      throw 'No status and story point change together.';
    }
    let newStatus = statusCategory(issueData.status);

    storyPointChange = issue.storyPoint as number;
    switch (oldStatus) {
      case 'NORMAL':
        if (newStatus === 'COMPLETE') {
          issueData.progress = 100;
          issueData.completedStoryPoint = issue.storyPoint;
          action = 'updateCompletedStoryPoint';
        } else if (newStatus === 'CANCEL') {
          storyPointChange = -storyPointChange;
          action = 'updateTotalStoryPoint';
        }
        break;
      case 'COMPLETE':
        issueData.progress = 0;
        issueData.completedStoryPoint = 0;
        storyPointChange = -storyPointChange;
        if (newStatus === 'NORMAL') {
          action = 'updateCompletedStoryPoint';
        } else if (newStatus === 'CANCEL') {
          action = 'updateBothStoryPoint';
        }
        break;
      case 'CANCEL':
        if (newStatus === 'COMPLETE') {
          issueData.progress = 100;
          issueData.completedStoryPoint = issue.storyPoint;
          action = 'updateBothStoryPoint';
        } else if (newStatus == 'NORMAL') {
          action = 'updateTotalStoryPoint';
        }
        break;
    }
  } else if (storyPointChange !== 0) {
    // pure story point change
    if (issue.status === IssueStatus.COMPLETED) {
      action = 'updateBothStoryPoint';
      issueData.completedStoryPoint = issueData.storyPoint;
    } else {
      action = 'updateTotalStoryPoint';
    }
  }

  console.log(
    'in server.routes.api.issues.update.start:',
    currentUser?.userId,
    issueData
  );
  let updateResult: Issue;
  try {
    // update issue
    updateResult = await prisma.issue.update({
      where: {
        id: issueData.id,
      },
      data: {
        ...issueData,
        meta: issueData.meta?.toString(), // fix ts error
        changeHistory: {
          create: {
            userId: currentUser.userId,
            modifiedAttribute: JSON.stringify(issueData),
          },
        },
      },
    });
    // update epic, sprint, milestone, project story point & completedStoryPoint when issue's related fields updated
    if (action !== '' && storyPointChange !== 0) {
      await Promise.all([
        updateParentIssueProgress(
          updateResult.parentIssueId as string,
          storyPointChange,
          action
        ),
        updateParentWorkplanProgress(
          updateResult.workPlanId as string,
          storyPointChange,
          action
        ),
        updateProjectStoryPointProgress(
          issue.projectId as string,
          storyPointChange,
          action
        ),
      ]);

      // handle phase change (moving from cross-sprint or between backlog and sprint)
    } else if (issue.workPlanId !== updateResult.workPlanId) {
      let ptsDelta = issue.storyPoint || 0;
      // if the issue was already completed, we should updateBothStoryPoint for old and new

      if (issue.status === IssueStatus.COMPLETED) {
        // old sprint
        updateParentWorkplanProgress(
          issue.workPlanId as string,
          -ptsDelta,
          'updateBothStoryPoint'
        );

        // new sprint
        updateParentWorkplanProgress(
          updateResult.workPlanId as string,
          ptsDelta,
          'updateBothStoryPoint'
        );
      } else {
        // for all other issue statuses, we can just update total storypoints for old and new
        // old sprint
        updateParentWorkplanProgress(
          issue.workPlanId as string,
          -ptsDelta,
          'updateTotalStoryPoint'
        );

        // new sprint
        updateParentWorkplanProgress(
          updateResult.workPlanId as string,
          ptsDelta,
          'updateTotalStoryPoint'
        );
      }
    }

    return updateResult;
  } catch (e) {
    console.log('in server.routes.api.issues.update.failure:', e);
    res
      .status(500)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }
};

export async function refreshParentProgress(parentIssueId: string) {
  const siblingIssues = await prisma.issue.findMany({
    where: { parentIssueId },
  });

  const total = siblingIssues.length;
  const completed = siblingIssues.filter(
    (child) => child.status === IssueStatus.COMPLETED
  ).length;

  const progress = total === 0 ? 0 : Math.floor((completed / total) * 100);

  await prisma.issue.update({
    where: { id: parentIssueId },
    data: {
      completedStoryPoint: completed,
      progress: progress,
    },
  });

  console.log(`Progress for parent issue ${parentIssueId} updated to ${progress}% (${completed}/${total})`);
}



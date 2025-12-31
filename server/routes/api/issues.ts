import {
  Comment,
  CommentStatus,
  DOCTYPE,
  Issue,
  IssueStatus,
  IssueType,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import { Router } from 'express';

import prisma from '../../db/prisma';

import {
  getDeliveryImpact,
  getDocumentForProject,
} from '../../services/documentService';
import {
  addIssueToBacklog,
  createWorkPlanAndIssues,
  generateRandomIssueId,
  insertIssueToEpicsInDocument,
} from '../../services/issueService';
import { IAddIssueInput } from '../types/entityType';
import { getProjectById } from '../../services/projectService';
import { ProfileResponse } from '../../types/response';
import { ProjectOutput } from '../../../shared/types';

import {
  AddAndPublishIssueInputSchema,
  IssueChangeHistoryOutput,
  IssueOutput,
  IssueOutputInclude,
  IssueSuggestionOutput,
} from '../types/issueTypes';
import {
  parseDevPlanContents,
  recreateDevPlan,
} from '../../services/schedulingService';
import { userProfileRequestHandler } from '../../lib/util';
import {
  CommentOutput,
  CommentOutputInclude,
  CommentPostSchema,
} from '../types/commentTypes';
import { updateParentIssue } from '../../lib/issueUpdateShared';

const router = Router();
router.use(userProfileRequestHandler);

// create issue
type CreateIssueBodyType = Omit<
  Prisma.IssueUncheckedCreateInput,
  'creatorUserId'
>;
router.post('/', async function (req, res: ProfileResponse<Issue>) {
  const currentUser = res.locals.currentUser;

  const issueData: CreateIssueBodyType = req.body; // TODO: Ensure we specify organization as part of this input

  console.log(
    'in server.routes.api.issues.post.start:',
    currentUser?.userId,
    issueData
  );
  let createResult;

  try {
    let project = await prisma.project.findUnique({
      where: { id: issueData.projectId },
    });

    if (!project) {
      throw Error('no project with id: ' + issueData.projectId);
    }

    let shortName = await generateRandomIssueId(project.shortName);
    createResult = await prisma.issue.create({
      data: {
        ...issueData,
        shortName,
        creatorUserId: currentUser?.userId as string,
      },
    });
  } catch (e) {
    console.log('in server.routes.api.issues.post.failure:', e);
    res
      .status(500)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }
  console.log('in server.routes.api.issues.post.result:', createResult);

  res.status(201).json({ success: true, data: createResult });
});

// update issue
router.post('/update', async function (req, res: ProfileResponse<Issue>) {
  const currentUser = res.locals.currentUser;

  const updateResult = (await updateParentIssue(
    currentUser,
    req.body,
    res
  )) as Issue;

  console.log('in server.routes.api.issues.update.result:', updateResult);
  res.status(201).json({ success: true, data: updateResult });
});

// add issue and suggestion insight to user
router.post(
  '/addSuggestion',
  async function (req, res: ProfileResponse<IssueSuggestionOutput>) {
    const currentUser = res.locals.currentUser;
    let {
      projectId,
      name,
      parentIssueId,
      workPlanId = '',
      storyPoint,
    } = req.body;
    console.log(
      'in server.routes.api.issues.addSuggestion.start:',
      currentUser?.userId,
      req.body
    );

    let [epic, sprint, devPlanDoc] = await Promise.all([
      prisma.issue.findUnique({
        where: {
          id: parentIssueId,
        },
      }),
      prisma.workPlan.findUnique({
        where: {
          id: workPlanId,
        },
      }),
      getDocumentForProject(projectId, DOCTYPE.DEVELOPMENT_PLAN),
    ]);
    let issueData: IAddIssueInput = {
      name,
      sprintKey: workPlanId
        ? ((sprint?.meta as Prisma.JsonObject).key as string)
        : '',
      parentIssueKey: (epic?.meta as Prisma.JsonObject).key as string,
      storyPoint,
    };

    const { devPlan: oldDevPlan, schedulingParameters } = parseDevPlanContents(
      devPlanDoc?.content,
      devPlanDoc?.meta
    );

    const updatedEpics = await insertIssueToEpicsInDocument(
      issueData,
      projectId,
      oldDevPlan
    );
    const newDevPlan = await recreateDevPlan(
      updatedEpics,
      schedulingParameters
    );

    // compare result to determine delivery impact for milestones
    let deliveryImpact = getDeliveryImpact(
      name,
      issueData.sprintKey,
      oldDevPlan,
      newDevPlan
    );
    console.log(
      'in server.routes.api.documents.devplan.result:',
      deliveryImpact
    );
    res.status(201).json({
      success: true,
      data: {
        newDevPlan,
        oldDevPlan,
        deliveryImpact,
        devPlanDocId: devPlanDoc?.id,
      },
    });
  }
);

// upsert document
router.post(
  '/addPublish',
  async function (req, res: ProfileResponse<ProjectOutput>) {
    const currentUser = res.locals.currentUser;
    const input = AddAndPublishIssueInputSchema.parse(req.body);
    console.log(
      'in server.routes.api.issues.addPublish.start:',
      currentUser?.userId,
      input.projectId,
      input.target
    );

    if (input.target === 'backlog') {
      // handle backlog item creation
      await addIssueToBacklog(
        input.projectId,
        input.issueName,
        currentUser?.userId as string
      );
    } else {
      const updateDevPlanDoc = prisma.document.update({
        where: {
          id: input.devPlanDocId,
        },
        data: {
          content: Buffer.from(JSON.stringify(input.devPlan)),
        },
      });
      // disable previously published issues/workplans
      const overwriteNonBuildableIssues = prisma.issue.updateMany({
        where: {
          projectId: input.projectId,
          type: {
            not: IssueType.BUILDABLE,
          },
          status: { not: IssueStatus.OVERWRITTEN },
        },
        data: {
          status: IssueStatus.OVERWRITTEN,
        },
      });

      const overwriteWorkPlans = prisma.workPlan.updateMany({
        where: {
          projectId: input.projectId,
          status: { not: IssueStatus.OVERWRITTEN },
        },
        data: {
          status: IssueStatus.OVERWRITTEN,
        },
      });

      try {
        await prisma.$transaction([
          updateDevPlanDoc,
          overwriteNonBuildableIssues,
          overwriteWorkPlans,
        ]);
      } catch (e) {
        console.error(
          'in server.routes.api.issues.addPublish.prisma.transaction.error:',
          e
        );
        res
          .status(500)
          .json({ success: false, errorMsg: 'Network error. Please retry.' });
        return;
      }
      try {
        await createWorkPlanAndIssues({
          projectId: input.projectId,
          creatorUserId: currentUser?.userId as string,
          organizationId: currentUser?.organizationId,
          devPlan: input.devPlan,
        });
      } catch (e) {
        console.error(
          'in server.routes.api.issues.addPublish.createWorkPlanAndIssues.error:',
          e
        );
        res
          .status(500)
          .json({ success: false, errorMsg: 'Network error. Please retry.' });
        return;
      }
    }

    let result = await getProjectById(
      currentUser,
      input.projectId,
      currentUser.organizationId
    );
    if (!result) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'project not found after updating' });
      return;
    }

    console.log('in server.routes.api.issues.addPublish.result:', result);
    res.status(201).json({
      success: true,
      data: result,
    });
  }
);

// get a specific issue
router.get(
  '/:issueShortName',
  async function (request, response: ProfileResponse<IssueOutput>) {
    try {
      const { issueShortName } = request.params;

      const issue = await prisma.issue.findUnique({
        where: { shortName: issueShortName },
        include: IssueOutputInclude,
      });

      if (!issue || issue.project.status === ProjectStatus.CANCELED) {
        console.info('Issue not found.', issueShortName);
        response
          .status(404)
          .json({ success: false, errorMsg: 'Issue not found' });
        return;
      }

      response.status(200).json({ success: true, data: issue });
    } catch (error) {
      console.error('Error in GET /issues/:issueId', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

module.exports = {
  className: 'issues',
  routes: router,
};

// Get all active issues for the current user
// Supports pagination via query params: ?page=1&limit=50
router.get(
  '/',
  async function (request, response: ProfileResponse<IssueOutput[]>) {
    try {
      const { userId } = response.locals.currentUser;

      // Support pagination query params (optional, defaults to first page with reasonable limit)
      const page = parseInt(request.query.page as string) || 1;
      const limit = Math.min(
        parseInt(request.query.limit as string) || 25,
        100
      ); // Max 100 issues per request
      const skip = (page - 1) * limit;

      // Lightweight include for dashboard - only select needed fields
      const lightweightInclude = {
        documents: {
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        parentIssue: {
          select: {
            id: true,
            name: true,
            shortName: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            shortName: true,
            status: true,
          },
        },
        workPlan: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      };

      // Fetch issues with pagination and lightweight includes
      const [issues, total] = await Promise.all([
        prisma.issue.findMany({
          where: {
            ownerUserId: userId,
            status: {
              not: {
                in: [
                  IssueStatus.COMPLETED,
                  IssueStatus.CANCELED,
                  IssueStatus.OVERWRITTEN,
                ],
              },
            },
            project: { status: { not: ProjectStatus.CANCELED } },
          },
          include: lightweightInclude,
          orderBy: {
            updatedAt: 'desc', // Most recently updated first
          },
          skip,
          take: limit,
        }),
        prisma.issue.count({
          where: {
            ownerUserId: userId,
            status: {
              not: {
                in: [
                  IssueStatus.COMPLETED,
                  IssueStatus.CANCELED,
                  IssueStatus.OVERWRITTEN,
                ],
              },
            },
            project: { status: { not: ProjectStatus.CANCELED } },
          },
        }),
      ]);

      response.status(200).json({
        success: true,
        data: issues as unknown as IssueOutput[],
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + issues.length < total,
        },
      });
    } catch (error) {
      console.error('Error in GET /issues', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// History
router.get(
  '/:issueShortName/history',
  async function (
    request,
    response: ProfileResponse<IssueChangeHistoryOutput[]>
  ) {
    try {
      const { issueShortName } = request.params;
      let issue = await prisma.issue.findUniqueOrThrow({
        where: {
          shortName: issueShortName,
        },
        select: {
          id: true,
        },
      });
      const data = await prisma.issueChangeHistory.findMany({
        where: {
          issueId: issue.id,
        },
      });
      response.status(200).json({ success: true, data });
    } catch (error) {
      console.error(
        'server.routes.api.issues.getIssueIdChangeHistoryError',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Comments api
// TODO: should limit user can only read/post comments from issues in its org.
router.get(
  '/:issueShortName/comments',
  async function (request, response: ProfileResponse<CommentOutput[]>) {
    try {
      const { issueShortName } = request.params;
      let issue = await prisma.issue.findUniqueOrThrow({
        where: {
          shortName: issueShortName,
        },
        select: {
          id: true,
        },
      });
      const data = await prisma.comment.findMany({
        where: {
          issueId: issue.id,
          status: CommentStatus.ACTIVE,
        },
        include: CommentOutputInclude,
      });
      response.status(200).json({ success: true, data });
    } catch (error) {
      console.error(
        'server.routes.api.issues.getIssueShortNameComments Error',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Post a new comment
router.post(
  '/:issueShortName/comments',
  async function (request, response: ProfileResponse<Comment>) {
    try {
      const { issueShortName } = request.params;
      const { userId } = response.locals.currentUser;

      let issue = await prisma.issue.findUniqueOrThrow({
        where: {
          shortName: issueShortName,
        },
        select: {
          id: true,
        },
      });

      const input = CommentPostSchema.parse(request.body);
      let createResult = await prisma.comment.create({
        data: {
          issueId: issue.id,
          userId: userId,
          content: input.content,
          replyTo: input.replyTo,
          status: CommentStatus.ACTIVE,
        },
      });

      response.status(201).json({ success: true, data: createResult });
    } catch (error) {
      console.error(
        'server.routes.api.issues.postIssueShortNameComments',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// update comment
// TODO: add auth check: comment should be updated by its author
router.post(
  '/:issueShortName/comments/:commentId',
  async function (request, response: ProfileResponse<Comment>) {
    try {
      const { issueShortName, commentId } = request.params;
      const { userId } = response.locals.currentUser;

      if (!request.body.content) {
        throw 'invalid comment update request, missing body';
      }

      let updateResult = await prisma.comment.update({
        where: {
          id: commentId,
        },
        data: {
          content: request.body.content,
        },
      });

      console.log('comment update result:', updateResult);
      response.status(201).json({ success: true, data: updateResult });
    } catch (error) {
      console.error(
        'server.routes.api.issues.postIssueShortNameCommentsCommentId',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

router.delete(
  '/:issueShortName/comments/:commentId',
  async function (request, response: ProfileResponse<null>) {
    try {
      const { issueShortName, commentId } = request.params;
      const { userId } = response.locals.currentUser;

      let updateResult = await prisma.comment.update({
        where: {
          id: commentId,
        },
        data: {
          status: CommentStatus.DELETED,
        },
      });
      console.log('comment update result:', updateResult);
      response.status(201).json({ success: true, data: null });
    } catch (error) {
      console.error(
        'server.routes.api.issues.deleteIssueShortNameCommentsCommentId Error',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

import { Router } from 'express';
import { userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import prisma from '../../db/prisma';
import {
  DOCTYPE,
  DocumentStatus,
  IssueStatus,
  IssueType,
  WorkPlanType,
} from '@prisma/client';
import { DevPlanInputSchema, DevPlanOutput } from '../types/devPlanTypes';
import {
  parseDevPlanContents,
  recreateDevPlan,
} from '../../services/schedulingService';
import { createWorkPlanAndIssues } from '../../services/issueService';
import { RedisSingleton } from '../../services/redis/redis';
import { getDefaultTemplateDocument } from '../../services/documentService';

const router = Router();
router.use(userProfileRequestHandler);

// Get a specific development plan by ID
router.get(
  '/:devPlanId',
  async function (request, response: ProfileResponse<DevPlanOutput>) {
    try {
      const { devPlanId } = request.params;
      const { userId, organizationId } = response.locals.currentUser;

      // first: check if document gen has completed and there is an error (for example, skill missing)
      const error = await RedisSingleton.getData(`devplan:${devPlanId}`);
      if (error) {
        throw new Error(error);
      }
      const dbDocument = await prisma.document.findUnique({
        where: { id: devPlanId },
        include: { project: true, templateDocument: true },
      });

      if (
        !dbDocument ||
        dbDocument.type !== DOCTYPE.DEVELOPMENT_PLAN // You have to use the /documents API to access other types of documents
      ) {
        throw new Error('Could not find this dev plan: ' + devPlanId);
      }

      // DocumentTemplate
      if (userId && !dbDocument.templateDocument) {
        dbDocument.templateDocument = await getDefaultTemplateDocument(
          dbDocument.type,
          response.locals.currentUser
        );
      }

      const { content, type, meta, ...document } = dbDocument;
      const { devPlan, schedulingParameters } = parseDevPlanContents(
        content,
        meta
      );
      response.status(200).json({
        success: true,
        data: {
          ...document,
          ...devPlan,
          ...schedulingParameters,
          type,
        },
      });
    } catch (error) {
      console.error('Error occurred in GET /devPlan/:devPlanId', error);
      response.status(200).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Save a specific dev plan by ID, overwriting what is already there
// This method also takes two parameters that control downstream effects:
//  - regenerate milestones - whether or not to rebuild the milesones and sprints
//  - publishPlan - whether or not to create the actual issues to track the work and mark the dev plan as completed
router.put(
  '/:devPlanId',
  async function (request, response: ProfileResponse<DevPlanOutput>) {
    try {
      const { userId, organizationId } = response.locals.currentUser;
      const { devPlanId } = request.params;
      const {
        epics: inputEpics,
        sprints: inputSprints,
        regenerateMilestones,
        publishPlan,
        ...schedulingParameters
      } = DevPlanInputSchema.parse(request.body);

      const devPlan = await recreateDevPlan(inputEpics, {
        ...schedulingParameters,
        sprintStartDate:
          schedulingParameters.sprintStartDate ||
          new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }),
      });

      const dbDocument = await prisma.document.update({
        where: { id: devPlanId },
        data: {
          organizationId,
          content: Buffer.from(JSON.stringify(devPlan), 'utf-8'),
          meta: {
            teammates: schedulingParameters.teamMembers
              .map(({ userId, specialty, storyPointsPerSprint }) =>
                [userId, specialty, storyPointsPerSprint].join(',')
              )
              .join(';'),
            sprintWeek: schedulingParameters.weeksPerSprint,
            sprintStartDate: schedulingParameters.sprintStartDate,
            requiredSpecialties:
              schedulingParameters.requiredSpecialties.join(','),
            chosenDocumentIds: schedulingParameters.chosenDocumentIds.join(','),
          },
          status: publishPlan
            ? DocumentStatus.PUBLISHED
            : DocumentStatus.CREATED,
        },
        include: { project: true },
      });

      // we will only publish the devPlan if the user clicks on "Publish Plan" button, which will set publishPlan to be true
      if (publishPlan) {
        await Promise.all([
          prisma.issue.updateMany({
            where: {
              projectId: dbDocument.projectId as string,
              type: { not: IssueType.BUILDABLE },
              status: { not: IssueStatus.OVERWRITTEN },
              OR: [
                { workPlanId: null },
                { workPlan: { type: { not: WorkPlanType.BACKLOG } } },
              ],
            },
            data: {
              status: IssueStatus.OVERWRITTEN,
            },
          }),
          prisma.workPlan.updateMany({
            where: {
              projectId: dbDocument.projectId as string,
              status: { not: IssueStatus.OVERWRITTEN },
              type: { not: WorkPlanType.BACKLOG },
            },
            data: {
              status: IssueStatus.OVERWRITTEN,
            },
          }),
        ]);
        // if doctype is DEVELOPMENT_PLAN, create issues/sprints and insert them into issue table
        await createWorkPlanAndIssues({
          projectId: dbDocument.projectId as string,
          creatorUserId: userId,
          organizationId,
          devPlan,
        });
        await prisma.issue.update({
          where: { id: dbDocument.issueId as string },
          data: {
            status: IssueStatus.COMPLETED,
            progress: 100,
            actualEndDate: new Date(),
          },
        });
      }
      const { content, type, meta, ...document } = dbDocument;
      const {
        devPlan: updatedDevPlan,
        schedulingParameters: updatedParameters,
      } = parseDevPlanContents(content, meta);
      response.status(200).json({
        success: true,
        data: {
          ...document,
          ...updatedDevPlan,
          ...updatedParameters,
          type: DOCTYPE.DEVELOPMENT_PLAN,
        },
      });
    } catch (error) {
      console.error('Error occurred in PUT /devPlan/:devPlanId', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

export const className = 'devPlan';
export const routes = router;

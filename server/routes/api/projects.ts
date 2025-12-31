import { Router } from 'express';
import {
  Project,
  ProjectStatus,
  TemplateProject,
  WorkPlanType,
  IssueStatus,
  IssueType,
  WorkPlanStatus,
  Issue,
  Access,
  DocumentStatus,
  ProjectPermission,
  DocumentPermissionTypes,
  Document,
} from '@prisma/client';
import { DocumentTypeNameMapping } from '../../lib/constant';
import prisma from '../../db/prisma';
import { IssuesData } from './../../db/seed/issueData';
import { deployCodeToVercelForRegenerate } from '../../services/deployService';
import { generateDeployDocId } from '../../lib/util';
import { userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import { AdminOrgId } from '../types/entityType';
import mixpanel from '../../services/trackingService';

import {
  CreateProjectInputSchema,
  ProjectOutput,
  ProjectInfo,
  ProjectAccessResponse,
} from '../../../shared/types';
import {
  checkProjectAccess,
  generateShortNameForProject,
  getAllAccessibleProjectsInfo,
  getProjectById,
  generateProjectTitleFromDescription,
} from '../../services/projectService';
import dayjs from 'dayjs';
import { generateIssueIdFromIndex } from '../../services/issueService';
import { createDocumentForBuildable } from '../../services/documentService';
import { sendEmail } from '../../services/emailService';
import { postProjectCreation } from '../../lib/emailTemplate';
import { DocumentPermissionStatus } from '@prisma/client';
import { ProjectShareTemplateData } from '../types/emailTemplateDataTypes';
import { sendTemplateEmail } from '../../services/sesMailService';

const router = Router();
router.use(userProfileRequestHandler);

router.post(
  '/',
  async function (
    req,
    res: ProfileResponse<Project & { documents: Document[] }>
  ) {
    const currentUser = res.locals.currentUser;
    const parseResult = CreateProjectInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Error parsing createProjectApi input', parseResult.error);
      res
        .status(500)
        .json({ success: false, errorMsg: parseResult.error.toString() });
      return;
    }
    const projectData = parseResult.data;
    // Always set ownerUserId to current user if not explicitly provided
    if (!projectData.ownerUserId) {
      projectData.ownerUserId = currentUser.userId;
    }

    console.log(
      'in server.routes.api.projects.post.start:',
      currentUser?.userId,
      projectData
    );

    const isFirstProject = await prisma.user.findUnique({
      where: {
        id: currentUser.userId,
        AND: [
          { ownedProjects: { none: {} } }, // No owned projects
        ],
      },
    });

    let createResult: Project;
    let documents: Document[];
    try {
      let userEnteredNameOrDescr = projectData.name;
      let generatedName = '';
      const hasChinese = /[\u4e00-\u9fa5]/.test(userEnteredNameOrDescr);
      const wordCount = userEnteredNameOrDescr.trim().split(/\s+/).length;
      const charCount = userEnteredNameOrDescr.trim().length;

      // 条件：如果是英文则看 word count > 3；如果是中文则看字符数 > 5
      const shouldGenerate =
        (hasChinese && charCount > 5) || (!hasChinese && wordCount > 3);

      if (shouldGenerate) {
        generatedName = await generateProjectTitleFromDescription(
          userEnteredNameOrDescr
        );
      }

      projectData.name = generatedName || userEnteredNameOrDescr;

      console.log(generatedName, 'output the truename of the project');
      let projectShortName = await generateShortNameForProject(
        projectData.name
      );
      console.log(
        projectShortName,
        'output the projectShortName of the project'
      );
      createResult = await prisma.project.create({
        data: {
          ...projectData,
          description: userEnteredNameOrDescr,
          shortName: projectShortName,
          organizationId: currentUser.organizationId,
          creatorUserId: currentUser.userId,
          ownerUserId: projectData.ownerUserId || currentUser.userId, // Ensure owner is always set
          access: projectData.access || Access.SELF,
          workPlans: {
            create: {
              name: 'Backlog',
              type: WorkPlanType.BACKLOG,
              status: IssueStatus.CREATED,
              creatorUserId: currentUser.userId,
              ownerUserId: projectData.ownerUserId || currentUser.userId,
              plannedEndDate: null,
            },
          },
        },
      });
      // track successful project creation
      mixpanel.track('Project Created', {
        distinct_id: currentUser.email,
        projectId: createResult.id,
        projectName: createResult.name,
      });
      // todo - move this out when template is ready for user to pick
      try {
        // create buildable issues
        let idx = 0;
        // create the buildable issues
        let buildables = await prisma.issue.createManyAndReturn({
          data: IssuesData.map((issue) => {
            idx += 1;
            let shortName = generateIssueIdFromIndex(projectShortName, idx);
            return {
              ...issue,
              shortName,
              projectId: createResult.id,
              creatorUserId: createResult.creatorUserId,
              ownerUserId: createResult.ownerUserId || currentUser.userId, // Ensure ownerUserId is always set
            };
          }),
        });
        // next create the documents for all the buildable issues
        documents = await Promise.all(
          buildables.map((buildable: Issue) => {
            // track successful project creation
            mixpanel.track('Document Created', {
              distinct_id: currentUser.email,
              projectId: createResult.id,
              projectName: createResult.name,
              name: buildable.name,
            });
            return createDocumentForBuildable({
              name: `${DocumentTypeNameMapping[buildable.name].name} - ${
                projectData.name
              }`,
              description:
                buildable.name === 'PRD' ? userEnteredNameOrDescr : '',
              issueId: buildable.id,
              projectId: createResult.id,
              type: DocumentTypeNameMapping[buildable.name].type,
              userId: createResult.creatorUserId,
              access: projectData.access || Access.SELF,
            });
          })
        );
        console.log('server.routes.api.projects.issues.success');
      } catch (err) {
        console.error('server.routes.api.projects.issues.error:', err);
        res
          .status(500)
          .json({ success: false, errorMsg: 'Error creating projects' });
        return;
      }
    } catch (e) {
      console.log('in server.routes.api.projects.post.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }
    console.log('in server.routes.api.projects.post.result:', createResult);

    if (isFirstProject) {
      await sendEmail({
        email: currentUser.email,
        subject: `🎉 Congrats on creating your first Omniflow project`,
        body: postProjectCreation(
          currentUser.firstname?.trim()
            ? currentUser.firstname
            : currentUser.email.split('@')[0],
          projectData.name
        ),
      });
    }
    res
      .status(201)
      .json({ success: true, data: { ...createResult, documents } });
  }
);

// get all project templates that are active
router.get(
  '/templates',
  async function (req, res: ProfileResponse<TemplateProject[]>) {
    // const currentUser = res.locals.currentUser;
    // get users
    let pTemplates = await prisma.templateProject.findMany({
      where: {
        organizationId: { in: [AdminOrgId /* currentUser?.organizationId */] }, // TODO: Resume including the user's organization ID
        status: ProjectStatus.COMPLETED,
      },
      include: {
        templateIssues: true,
      },
    });

    console.log('in server.routes.api.projects.templates.get.all:', pTemplates);
    res.status(200).json({
      success: true,
      data: pTemplates,
    });
  }
);

// get all project
router.get('/all', async function (req, res: ProfileResponse<ProjectInfo[]>) {
  // get projects
  const projects = await getAllAccessibleProjectsInfo(res.locals.currentUser);
  res.status(200).json({ success: true, data: projects });
});

// get a specific project
router.get(
  '/:projectId',
  async function (req, res: ProfileResponse<ProjectOutput>) {
    const { organizationId } = res.locals.currentUser;
    const { projectId } = req.params;

    console.log('in server.routes.api.projects.get.projectId', projectId);

    try {
      // PERFORMANCE: Optimized query with selective loading
      const project = await getProjectById(
        res.locals.currentUser,
        projectId,
        organizationId
      );

      if (!project) {
        res.status(400).json({
          success: false,
          errorMsg: 'Project not found or you do not have access.',
        });
        return;
      }

      // Add cache headers to improve client-side performance
      res.setHeader(
        'Cache-Control',
        'private, max-age=10, stale-while-revalidate=30'
      );
      res.status(200).json({ success: true, data: project });
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch project. Please try again.',
      });
    }
  }
);

// get a specific project's view/edit/null access
router.get(
  '/:projectId/access',
  async function (req, res: ProfileResponse<ProjectAccessResponse>) {
    const { email, userId, organizationId } = res.locals.currentUser;
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      res.status(401).json({ success: false, errorMsg: 'Project not found' });
      return;
    }

    const result = await checkProjectAccess(
      project,
      email,
      userId,
      organizationId
    );

    res.status(200).json({ success: true, data: result });
  }
);

/**
 * Update a project
 */
router.put('/:projectId', async function (req, res: ProfileResponse<Project>) {
  const { projectId } = req.params;
  const { userId } = res.locals.currentUser;

  const { name, description, dueDate } = req.body;
  const newOwnerUserId = req.body?.ownerUserId;

  // get existing project in order to validate if user has permission
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      ownerUserId: userId,
    },
  });
  if (!project) {
    res
      .status(401)
      .json({ success: false, errorMsg: 'User is not Project Owner' });
    return;
  }

  try {
    const result = await prisma.project.update({
      where: {
        id: projectId,
        ownerUserId: userId,
      },
      data: {
        name: name,
        description: description,
        dueDate: dayjs(dueDate).toISOString(),
        owner: {
          connect: { id: newOwnerUserId },
        },
      },
    });

    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('server.routes.api.projects.put failure:', e);
    res.status(500).json({ success: false, errorMsg: e as string });
    return;
  }
});

/**
 * Delete a project
 */
router.delete('/:projectId', async function (req, res: ProfileResponse<null>) {
  const { projectId } = req.params;
  const { userId, role, organizationId } = res.locals.currentUser;

  console.log('server.routes.api.projects.delete.projectId', projectId);

  // Perform soft deletion by setting the project Status to Cancelled
  // Only works if the project's owner or creator is the current user

  try {
    let whereClause = {
      id: projectId,
      OR: [{ ownerUserId: userId }, { creatorUserId: userId }],
    };
    await prisma.project.update({
      where: whereClause,
      data: {
        status: ProjectStatus.CANCELED,
      },
    });
  } catch (e) {
    console.error('api.projects.delete.error:', e);
    res
      .status(401)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }

  // Cascade soft deletion to Issues and Workplans
  try {
    await Promise.all([
      prisma.issue.updateMany({
        where: {
          status: {
            not: IssueStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectId,
          },
        },
        data: {
          status: IssueStatus.CANCELED,
        },
      }),
      prisma.workPlan.updateMany({
        where: {
          status: {
            not: WorkPlanStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectId,
          },
        },
        data: {
          status: WorkPlanStatus.CANCELED,
        },
      }),
      prisma.document.updateMany({
        where: {
          status: {
            not: WorkPlanStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectId,
          },
        },
        data: {
          status: DocumentStatus.CANCELED,
        },
      }),
    ]);

    res.status(200).json({ success: true, data: null });
  } catch (e) {
    console.error('server.routes.api.projects.delete', e);
    res.status(500).json({ success: false, errorMsg: e as string });
  }
});

// This is not currently being used so commenting it out, but I don't want to lose track of this code
// // get all projects that are active
// router.get('/status', async function (req, res: ProfileResponse<IProjectResponse>) {
//   const { projectId } = req.query;

//   // todo - move this condition below to only happen when a specific project is being queried against: to be below line 97
//   let include = {
//     workPlans: {
//       where: {
//         type: WorkPlanType.MILESTONE,
//         status: IssueStatus.CREATED,
//       },
//       include: {
//         childWorkPlans: true,
//       },
//     },
//     issues: {
//       where: VisibleIssues,
//       include: {
//         parentIssue: true,
//       },
//     },
//   };
//   // get projects
//   let project = (await prisma.project.findFirst({
//     where: { id: projectId as string },
//     include,
//   })) as IProjectResponse;
//   let result = await genWeeklyStatus(projectId as string);
//   console.log('in server.routes.api.projects.get.status:', projectId, result);
//   project.weeklyStatus = result;
//   res
//     .status(200)
//     .json({ success: true, data: project });
// });

// Cancels a planning step. The step has to not be completed or canceled already, and the project cannot have started
router.delete(
  '/:projectId/planningStep/:issueId',
  async function (request, response: ProfileResponse<void>) {
    try {
      const { projectId, issueId } = request.params;
      const { organizationId } = response.locals.currentUser;

      // We use DeleteMany so we can do extra checking to make sure we only delete issues that match everything, not just ID
      const result = await prisma.issue.updateMany({
        where: {
          id: issueId,
          type: IssueType.BUILDABLE,
          status: {
            not: { in: [IssueStatus.COMPLETED, IssueStatus.CANCELED] },
          },
          project: {
            status: ProjectStatus.CREATED,
            id: projectId,
            organizationId,
          },
        },
        data: {
          status: IssueStatus.CANCELED,
        },
      });

      if (result.count === 0) {
        throw new Error(
          'The specified planning step could not be found: ' + issueId
        );
      }
      if (result.count !== 1) {
        throw new Error(
          '[CRITICAL] Deleting this issue ID modified more than one database record: ' +
            issueId
        );
      }

      response.status(200).json({ success: true, data: undefined });
    } catch (error) {
      console.error(
        'An error occurred in DELETE /projects/:projectId/planningStep/:issueId',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Get project permission
router.get(
  '/:projectId/permission',
  async function (request, response: ProfileResponse<ProjectPermission[]>) {
    try {
      const { projectId } = request.params;
      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!dbProject) {
        throw new Error('Could not find this project: ' + projectId);
      }

      // Fetch active project permissions
      const result = await prisma.projectPermission.findMany({
        where: {
          projectId,
          status: DocumentPermissionStatus.ACTIVE,
        },
      });

      response.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.log(
        'in server.routes.api.project.permission.get.failure:',
        error
      );
      response
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
    }
  }
);

// Add or update project permission
router.post(
  '/:projectId/permission',
  async function (request, response: ProfileResponse<string>) {
    try {
      const { projectId } = request.params;
      let userIds: [string] = request.body.userIds; // User IDs for email sharing
      console.log(
        'in api.projects.post.projectId.permission:',
        JSON.stringify(request.body)
      );

      const currentUser = response.locals.currentUser;

      const {
        emails,
        permission,
        projectPermissions,
        projectAccess,
        shareUrl,
      }: {
        projectId: string;
        emails: string[];
        permission: DocumentPermissionTypes;
        projectPermissions: ProjectPermission[];
        projectAccess: Access;
        shareUrl: string;
      } = request.body;

      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!dbProject) {
        throw new Error('Could not find this project: ' + projectId);
      }

      // Update existing permissions
      for (const projectPermission of projectPermissions) {
        await prisma.projectPermission.update({
          where: {
            id: projectPermission.id,
          },
          data: {
            permission: projectPermission.permission,
          },
        });
      }

      // To delete permissions
      const dbPermissions = await prisma.projectPermission.findMany({
        where: {
          projectId,
        },
      });
      const toDeletePermissionIds = [];
      for (const dbPermission of dbPermissions) {
        if (
          !projectPermissions.some(
            (projectPermission) => dbPermission.id === projectPermission.id
          )
        ) {
          toDeletePermissionIds.push(dbPermission.id);
        }
      }
      await prisma.projectPermission.updateMany({
        where: {
          id: {
            in: toDeletePermissionIds,
          },
        },
        data: {
          status: DocumentPermissionStatus.CANCELED,
        },
      });

      // Update Project access
      await prisma.project.update({
        where: {
          id: projectId,
        },
        data: {
          access: projectAccess,
        },
      });

      // Add new permissions
      const toCreateEmails = emails.filter(
        (email) =>
          !projectPermissions
            .map((projectPermission) => projectPermission.email)
            .includes(email)
      );

      const toCreatePermissions = toCreateEmails.map((email) => {
        return {
          projectId,
          email,
          permission,
          status: DocumentPermissionStatus.ACTIVE,
        };
      });

      await prisma.projectPermission.createMany({
        data: toCreatePermissions,
      });

      const currentUserProfile = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { firstname: true, lastname: true },
      });

      if (userIds && userIds.length) {
        // Send Share Email to users
        const toUsers = await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
        });

        for (const toUser of toUsers) {
          sendTemplateEmail<ProjectShareTemplateData>({
            templateName: 'DocLink', // for now
            recipientEmails: [toUser.email],
            TemplateData: {
              recipient_name: `${toUser.firstname} ${toUser.lastname}`,
              sender_name: `${currentUserProfile?.firstname} ${currentUserProfile?.lastname}`,
              doc_name: dbProject.name,
              link: shareUrl,
            },
          });
        }
      }

      for (const email of toCreateEmails) {
        sendTemplateEmail<ProjectShareTemplateData>({
          templateName: 'DocLink', // for now
          recipientEmails: [email],
          TemplateData: {
            recipient_name: `${email}`,
            sender_name: `${currentUserProfile?.firstname} ${currentUserProfile?.lastname}`,
            doc_name: dbProject.name,
            link: shareUrl,
          },
        });
      }

      response.status(201).json({
        success: true,
        data: 'ok',
      });
    } catch (error) {
      console.log(
        'in server.routes.api.project.permission.post.failure:',
        error
      );
      response
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
    }
  }
);

/**
 * Deploy all documents from a cloned project
 */
async function deployClonedProjectDocuments(
  project: any,
  sendUpdate?: (data: any) => void
) {
  try {
    console.log(`Starting deployment for cloned project: ${project.name}`);

    // Get all documents that have content and are deployable
    const deployableDocuments = project.documents.filter(
      (doc: any) =>
        doc.content && doc.content.length > 0 && doc.type === 'PROTOTYPE'
    );

    if (deployableDocuments.length === 0) {
      console.log('No deployable documents found in cloned project');
      return;
    }

    console.log(
      `Found ${deployableDocuments.length} deployable documents to deploy`
    );

    // Just deploy the prototype to save time and resource
    if (deployableDocuments.length === 0) {
      console.log('No deployable prototype found in cloned project');
      return;
    }

    const document = deployableDocuments[0]; // Get the first (and only) prototype document

    try {
      console.log(`Deploying document: ${document.name} (${document.type})`);

      // Send deploying status (same as sendUpdate in deploy.ts)
      if (sendUpdate) {
        sendUpdate({ status: { message: 'deploying.app' } });
      }

      // Generate deploy document ID
      const deployDocId = generateDeployDocId(
        document.name,
        document.type,
        document.id
      );

      // Get the content as string
      const generateContent = document.content.toString('utf-8');

      // Deploy the document (use preview for cloned projects)
      const deployResult = await deployCodeToVercelForRegenerate(
        deployDocId,
        generateContent,
        null,
        project.organizationId,
        document.id,
        'preview'
      );

      if (deployResult.success) {
        console.log(
          `✅ Successfully deployed ${document.name}: ${deployResult.sourceUrl}`
        );

        // Send completion status (same as sendUpdate in deploy.ts)
        if (sendUpdate) {
          sendUpdate({
            status: { message: 'Deployment complete' },
            sourceUrl: deployResult.sourceUrl,
            success: true,
          });
        }

        // Update document with deployment URL (single update only)
        await prisma.document.update({
          where: { id: document.id },
          data: {
            url: deployResult.sourceUrl,
            meta: {
              ...((document.meta as any) || {}),
              sourceUrl: deployResult.sourceUrl,
              deployedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        console.error(
          `❌ Failed to deploy ${document.name}: ${deployResult.errorMessage}`
        );

        // Send failure status (same as sendUpdate in deploy.ts)
        if (sendUpdate) {
          sendUpdate({
            status: { message: 'Deployment failed' },
            error: deployResult.errorMessage,
            success: false,
          });
        }
      }
    } catch (error) {
      console.error(`Error deploying document ${document.name}:`, error);

      if (sendUpdate) {
        sendUpdate({
          status: { message: 'Deployment failed' },
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    console.log(`Completed deployment for cloned project: ${project.name}`);
  } catch (error) {
    console.error('Error in deployClonedProjectDocuments:', error);
  }
}

// Deploy cloned project streaming endpoint
router.post(
  '/:projectId/deploy-clone-streaming',
  async function (req, res: ProfileResponse<Project>) {
    const { projectId } = req.params;
    const currentUser = res.locals.currentUser;

    try {
      // Set headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Helper function to send updates
      const sendUpdate = (data: any) => {
        res.write(`${JSON.stringify(data)}\n\n`);
      };

      // Get the cloned project
      const clonedProject = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          documents: true,
          issues: true,
        },
      });

      if (!clonedProject) {
        sendUpdate({
          status: { message: 'Deployment failed' },
          error: 'Project not found',
          success: false,
        });
        res.end();
        return;
      }

      // Deploy the cloned project documents with streaming updates
      await deployClonedProjectDocuments(clonedProject, sendUpdate);

      res.end();
    } catch (error) {
      console.error('Error in clone deployment streaming:', error);
      res.write(
        JSON.stringify({
          status: { message: 'Deployment failed' },
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        }) + '\n\n'
      );
      res.end();
    }
  }
);

// Clone project endpoint
router.post(
  '/:projectId/clone',
  async function (req, res: ProfileResponse<Project>) {
    const currentUser = res.locals.currentUser;
    const { projectId } = req.params;

    try {
      // Check if user has access to the project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        res.status(404).json({
          success: false,
          errorMsg: 'Project not found',
        });
        return;
      }

      const projectAccess = await checkProjectAccess(
        project,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!projectAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'You do not have access to this project',
        });
        return;
      }

      // Get the original project with all its data
      const originalProject = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          documents: true,
          issues: true,
          permissions: true,
        },
      });

      if (!originalProject) {
        res.status(404).json({
          success: false,
          errorMsg: 'Project not found',
        });
        return;
      }

      // Extract clone number from the project name if it exists, otherwise start at 1
      const match = originalProject.name.match(/clone \[(\d+)\]$/);
      let clonedProjectName: string;

      if (match) {
        // Project already has "clone [N]", increment the number
        const currentNumber = parseInt(match[1], 10);
        const nextNumber = currentNumber + 1;
        clonedProjectName = originalProject.name.replace(
          /clone \[(\d+)\]$/,
          `clone [${nextNumber}]`
        );
      } else {
        // First clone of this project
        clonedProjectName = `${originalProject.name} clone [1]`;
      }

      // Create the cloned project
      const clonedProject = await prisma.project.create({
        data: {
          name: clonedProjectName,
          description: originalProject.description,
          dueDate: originalProject.dueDate,
          access: originalProject.access,
          ownerUserId: currentUser.userId, // Clone owner is the current user
          organizationId: originalProject.organizationId,
          teamId: originalProject.teamId,
          status: originalProject.status,
          creatorUserId: currentUser.userId,
          shortName: await generateShortNameForProject(clonedProjectName),
        },
      });

      // Create a mapping of original issue IDs to cloned issue IDs
      const issueIdMapping = new Map<string, string>();

      // Clone issues (buildables) first
      for (const issue of originalProject.issues) {
        const clonedIssue = await prisma.issue.create({
          data: {
            name: issue.name,
            type: issue.type,
            status: issue.status,
            projectId: clonedProject.id,
            creatorUserId: currentUser.userId,
            ownerUserId: currentUser.userId,
            organizationId: issue.organizationId,
            description: issue.description,
            plannedStartDate: issue.plannedStartDate,
            plannedEndDate: issue.plannedEndDate,
            storyPoint: issue.storyPoint,
            progress: issue.progress,
            completedStoryPoint: issue.completedStoryPoint,
            meta: issue.meta as any,
            shortName: `${
              issue.shortName
            }-${dayjs().minute()}${dayjs().second()}`, // to ensure the short name is unique
          },
        });

        // Store the mapping from original issue ID to cloned issue ID
        issueIdMapping.set(issue.id, clonedIssue.id);
      }

      // Clone documents and link them to cloned issues
      for (const document of originalProject.documents) {
        // Handle meta field properly to avoid iteration issues
        let clonedMeta: any = {};
        if (document.meta) {
          try {
            // If meta is a string, parse it
            if (typeof document.meta === 'string') {
              clonedMeta = JSON.parse(document.meta);
            } else {
              // If meta is already an object, clone it
              clonedMeta = JSON.parse(JSON.stringify(document.meta));
            }

            // Reset history to empty array to avoid iteration issues
            clonedMeta.history = [];
          } catch (error) {
            console.error(
              'Error processing document meta during clone:',
              error
            );
            clonedMeta = {};
          }
        }

        // Directly copy binary content - much simpler and safer
        const clonedContent = document.content;

        // Find the corresponding cloned issue ID
        const clonedIssueId = document.issueId
          ? issueIdMapping.get(document.issueId)
          : null;

        const clonedDocument = await prisma.document.create({
          data: {
            name: document.name,
            description: document.description,
            type: document.type,
            status: document.status,
            projectId: clonedProject.id,
            issueId: clonedIssueId, // Link to the cloned issue
            creatorUserId: currentUser.userId,
            organizationId: document.organizationId,
            content: clonedContent,
            meta: {},
            access: document.access,
            url: '', // Reset URL for cloned document
          },
        });

        // Clone document permissions for the current user
        await prisma.documentPermission.create({
          data: {
            documentId: clonedDocument.id,
            userId: currentUser.userId,
            email: currentUser.email,
            permission: 'EDIT',
            status: 'ACTIVE',
          },
        });
      }

      // Clone project permissions (but only for the current user)
      await prisma.projectPermission.create({
        data: {
          projectId: clonedProject.id,
          email: currentUser.email,
          permission: 'EDIT',
          status: 'ACTIVE',
        },
      });

      // Get the complete cloned project with all relations
      const completeClonedProject = await prisma.project.findUnique({
        where: { id: clonedProject.id },
        include: {
          documents: true,
          issues: true,
          permissions: true,
        },
      });

      if (!completeClonedProject) {
        res.status(500).json({
          success: false,
          errorMsg: 'Failed to retrieve cloned project',
        });
        return;
      }

      // Don't deploy asynchronously - let frontend trigger it via streaming endpoint
      res.status(201).json({
        success: true,
        data: completeClonedProject,
      });
    } catch (error) {
      console.error('Error cloning project:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to clone project. Please try again.',
      });
    }
  }
);

module.exports = {
  className: 'projects',
  routes: router,
};

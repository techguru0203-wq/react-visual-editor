import { Router } from 'express';

import prisma from '../../db/prisma';
import { AuthenticatedResponse } from '../../types/response';
import {
  getJiraDataWithValidToken,
  getJiraResource,
  createJiraProject,
  createJiraIssue,
  createSprintForBoard,
  createFilterForProject,
  getSprintAndStoryPointsFieldIds,
  getBoardsOfProject,
  createBoardForProject,
  saveJiraLabelForMilestone,
  getAllJiraUsers,
  getScreens,
  getDefaultTabForScreen,
  addFieldToScreenTab,
} from '../../services/jiraService';
import { JiraResource, JiraEntity } from '../../../shared/types/jiraTypes';
import { readJiraUserProfile } from '../../services/userService';
import { ProjectInfo } from '../../../shared/types';
import {
  generateShortNameForProject,
  saveJiraProfileForProject,
} from '../../services/projectService';
import { generateIssueIdFromIndex } from '../../services/issueService';
import { getIssues } from '../../services/issueService';
import { IssueStatus } from '@prisma/client';
import { getMilestonesForProject } from '../../services/milestoneService';
import { getSprintsForProject } from '../../services/sprintService';
import { getUsersForProject } from '../../services/userService';

const router = Router();

// create issue
router.post('/project', async function (req, res: AuthenticatedResponse<null>) {
  let { userId, projectId } = req.body;

  console.log('in server.routes.api.admin.project.update:', userId, projectId);

  if (userId !== process.env.superAdminUserId) {
    res.status(400).json({
      success: false,
      errorMsg: 'Permission denied.',
    });
    return;
  }

  try {
    await prisma.workPlan.deleteMany({
      where: {
        projectId,
      },
    });
    await prisma.issue.deleteMany({
      where: {
        projectId,
        type: {
          not: 'BUILDABLE',
        },
      },
    });
  } catch (e) {
    console.log('in server.routes.api.admin.update..failure:', e);
    res
      .status(500)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }
  console.log('in server.routes.api.admin.update.success');
  res.status(201).json({ success: true, data: null });
});

router.get(
  '/jiraResource',
  async function (req, res: AuthenticatedResponse<JiraResource[]>) {
    const userId = res.locals.currentUser.userId;
    let jiraResources: JiraResource[] = [];
    try {
      jiraResources = await getJiraDataWithValidToken(function () {
        return getJiraResource(userId);
      }, userId);
    } catch (e) {
      console.log('server.routes.api.admin.jiraResource.error', e);
      res.status(500).json({
        success: false,
        errorMsg: JSON.stringify(e),
      });
      return;
    }
    // Return the authorization URL to Jira.
    res.status(200).json({
      success: true,
      data: jiraResources,
    });
  }
);

function isActive(status: string): boolean {
  return status !== IssueStatus.CANCELED && status !== IssueStatus.OVERWRITTEN;
}

async function getScreenForTheProject(
  willyUserUuid: string,
  jiraResourceId: string,
  jiraProjectKey: string
) {
  const allScreens = [];
  let startAt = 0;
  while (true) {
    const screens = await getScreens(willyUserUuid, jiraResourceId, startAt);
    allScreens.push(...screens.data.values);
    startAt += 100;
    if (allScreens.length >= screens.data.total) {
      break;
    }
  }
  let ret = [];
  for (const screen of allScreens) {
    if (screen.name.includes(`${jiraProjectKey}`)) {
      ret.push(screen);
    }
  }
  return ret;
}

export const publishIssuesForProject = async function (
  projectInfo: ProjectInfo,
  willyUserUuid: string, // To retrieve access tokens.
  jiraResourceId: string, // Jira resource id.
  jiraProjectKey: string // To retrieve project key.
) {
  // Sprint field and story point field are custom fields with specific ids.
  // We need to query the id for the following usages.
  const { sprintFieldId, storyPointsFieldId } =
    await getSprintAndStoryPointsFieldIds(willyUserUuid, jiraResourceId);

  const boards = await getBoardsOfProject(
    willyUserUuid,
    jiraResourceId,
    jiraProjectKey
  );
  if (boards.length === 0) {
    throw new Error('No scrum board found for project: ' + projectInfo.id);
  }
  const jiraScrumBoard = boards.values[0];
  const [willyIssues, willyMilestones, willySprints, willyUserJiraId] =
    await Promise.all([
      getIssues(projectInfo.id), // willy id
      getMilestonesForProject(projectInfo.id),
      getSprintsForProject(projectInfo.id),
      getUsersForProject(projectInfo.id),
    ]);

  const willyUserJiraIdMap = new Map<string, string>();
  for (const user of willyUserJiraId) {
    if (user?.jiraId) {
      willyUserJiraIdMap.set(user.willyId, user.jiraId);
    }
  }

  const willySprintMap = new Map<string, number>();
  const willySprintNameMap = new Map<string, number>();
  for (const willySprint of willySprints) {
    console.log(
      `Creating Sprint ${willySprint.name} for project: ${projectInfo.id}`
    );
    let jiraId = willySprintNameMap.get(willySprint.name);
    if (!jiraId) {
      const jiraSprintInfo = await createSprintForBoard(
        willySprint,
        willyUserUuid,
        jiraResourceId,
        jiraScrumBoard.id
      );
      jiraId = jiraSprintInfo.id;
      willySprintNameMap.set(willySprint.name, jiraSprintInfo.id);
    }
    if (jiraId) {
      willySprintMap.set(willySprint.id, jiraId);

      // Consider updateMany instead
      await prisma.workPlan.update({
        where: {
          id: willySprint.id,
        },
        data: {
          jiraSprintId: `${jiraId}`,
        },
      });
    } else {
      throw new Error(
        'Failed to create sprint in Jira for willy sprint: ' +
          willySprint.toString()
      );
    }
  }

  // Create filter for Kanban
  const jiraProjectFilter = await createFilterForProject(
    willyUserUuid,
    jiraResourceId,
    jiraProjectKey
  );

  // Create Kanban Board.
  await createBoardForProject(
    willyUserUuid,
    jiraResourceId,
    jiraProjectKey,
    jiraProjectFilter.id,
    'Kanban board',
    'kanban'
  );

  const screens = await getScreenForTheProject(
    willyUserUuid,
    jiraResourceId,
    jiraProjectKey
  );
  for (const screen of screens) {
    const defaultTab = await getDefaultTabForScreen(
      willyUserUuid,
      jiraResourceId,
      screen.id as number
    );
    await addFieldToScreenTab(
      willyUserUuid,
      jiraResourceId,
      screen.id as number,
      defaultTab.id as number,
      storyPointsFieldId
    );
    console.log('Successfully added the Story Point field to :', screen);
  }

  // Workplan id or issue id --> milestone name
  const willyMilestoneMap = new Map<string, string>();
  for (const milestone of willyMilestones) {
    // Project key + milestone , e.g. [WILLY]_Milestone_1
    const labelName =
      '[' + projectInfo.jira_key + ']_' + milestone.name.replace(' ', '_');
    willyMilestoneMap.set(milestone.id, labelName);
    saveJiraLabelForMilestone(milestone.id, labelName);
  }

  console.log(
    'Total issues number for project ',
    projectInfo.id,
    ' = ',
    willyIssues.length
  );

  // Create Epic.
  for (const issue of willyIssues) {
    if (issue.type === 'EPIC' && isActive(issue.status)) {
      const milestone = willyMilestoneMap.get(issue.workPlanId);
      console.log('Creating Epic: ', issue.name, ' milestone = ', milestone);

      if (milestone) {
        willyMilestoneMap.set(issue.id, milestone);
      }
      await createJiraIssue(
        issue,
        willyUserUuid,
        jiraResourceId,
        jiraProjectKey,
        milestone ? [milestone] : [],
        new Map<string, string>(),
        willyUserJiraIdMap
      );
    }
  }

  // Create Story, this has been done after Epic creation due to the dependency.
  for (const issue of willyIssues) {
    if (issue.type === 'STORY' && isActive(issue.status)) {
      console.log('Creating Story: ', issue.name);
      const milestone = willyMilestoneMap.get(issue.parentIssueId);
      if (milestone) {
        willyMilestoneMap.set(issue.id, milestone);
      }
      let customFieldValues = new Map<string, any>();
      const jiraSprintId = willySprintMap.get(issue.workPlanId);
      if (jiraSprintId && sprintFieldId) {
        customFieldValues.set(sprintFieldId, jiraSprintId);
      }
      if (issue.storyPoint) {
        customFieldValues.set(storyPointsFieldId, issue.storyPoint);
      }
      await createJiraIssue(
        issue,
        willyUserUuid,
        jiraResourceId,
        jiraProjectKey,
        milestone ? [milestone] : [],
        customFieldValues,
        willyUserJiraIdMap
      );
    }
  }

  // Create Task, this has been done after Story creation due to the dependency.
  for (const issue of willyIssues) {
    if (issue.type === 'TASK' && isActive(issue.status)) {
      console.log('Creating Task: ', issue.name);
      if (issue.parentIssueId === null) {
        console.error(`Task ${issue.id} without parent issue (Story).`);
        continue;
      }
      const milestone = willyMilestoneMap.get(issue.parentIssueId);
      let customFieldValues = new Map<string, any>();
      await createJiraIssue(
        issue,
        willyUserUuid,
        jiraResourceId,
        jiraProjectKey,
        milestone ? [milestone] : [],
        customFieldValues,
        willyUserJiraIdMap
      );
    }
  }
};

router.post(
  '/createJiraProject',
  async function (req, res: AuthenticatedResponse<string>) {
    try {
      const userId = res.locals.currentUser.userId;
      const jiraProfile = await readJiraUserProfile(userId);
      if (!jiraProfile) {
        res.status(500).json({
          success: false,
          errorMsg: 'Jira profile not found.',
        });
        return;
      }
      const projectInfo = req.body.project as ProjectInfo;
      const jiraProjectEntity = (await getJiraDataWithValidToken(function () {
        return createJiraProject(projectInfo.name, userId, jiraProfile);
      }, userId)) as JiraEntity;
      saveJiraProfileForProject(projectInfo.id, jiraProjectEntity);

      // Return the authorization URL to Jira.
      res.status(200).json({
        success: true,
        data: JSON.stringify(jiraProjectEntity),
      });

      projectInfo.jira_key = jiraProjectEntity.key;
      // Syncrhonize issue in async way.
      publishIssuesForProject(
        projectInfo,
        userId,
        jiraProfile.resource.id,
        jiraProjectEntity.key
      );
      console.log(
        'Project synchronization completed. (id = ',
        projectInfo.id,
        ')'
      );
    } catch (e) {
      res.status(500).json({
        success: false,
        errorMsg: JSON.stringify(e),
      });
    }
  }
);

// one time api, fix short for legacy entries after db schema migrated
// after migration, this api should be disable
router.post(
  '/shortNameFixing/:startIdx',
  async function (request, response: AuthenticatedResponse<string[]>) {
    let { userId } = response.locals.currentUser;

    console.log(
      'in server.routes.api.admin.shortNameFixing with useId:',
      userId
    );

    if (userId !== process.env.superAdminUserId) {
      response.status(400).json({
        success: false,
        errorMsg: 'Permission denied.',
      });
      return;
    }

    try {
      let idx = parseInt(request.params.startIdx);
      let logs = [];
      let projects = await prisma.project.findMany();
      for (let project of projects) {
        if (project.id == project.shortName) {
          logs.push('update project: ' + project.name);
          let shortName = await generateShortNameForProject(project.name);
          await prisma.project.update({
            where: { id: project.id },
            data: {
              shortName: shortName,
            },
          });
          // make sure issue's generate below uses the new project shortname
          project.shortName = shortName;
        }
      }

      let projectMap = new Map(projects.map((obj) => [obj.id, obj]));
      let issues = await prisma.issue.findMany();
      for (let issue of issues) {
        if (issue.id == issue.shortName) {
          let proj = projectMap.get(issue.projectId);
          if (!proj) {
            logs.push(`no project for issue ${issue.id}, ${issue.projectId}`);
            continue;
          }

          logs.push('update issue: ' + issue.name);
          await prisma.issue.update({
            where: { id: issue.id },
            data: {
              shortName: generateIssueIdFromIndex(proj.shortName, idx),
            },
          });
          idx += 1;
        }
      }

      response.status(200).json({ success: true, data: logs });
    } catch (error) {
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

router.get(
  '/jiraUsers',
  async function (req, res: AuthenticatedResponse<JiraResource[]>) {
    const userId = res.locals.currentUser.userId;
    let jiraProfile;
    try {
      jiraProfile = await readJiraUserProfile(userId);
    } catch (e) {
      console.error('server.routes.api.admin.jiraUsers.error', e);
      res.status(500).json({
        success: false,
        errorMsg: 'Jira profile not found and server error:' + e,
      });
      return;
    }
    if (!jiraProfile) {
      res.status(200).json({
        success: false,
        errorMsg: 'Jira profile not found.',
      });
      return;
    }
    let jiraUsers: any[] = [];
    try {
      jiraUsers = await getJiraDataWithValidToken(function () {
        return getAllJiraUsers(userId, jiraProfile.resource.id);
      }, userId);
    } catch (e) {
      console.log('server.routes.api.admin.jiraUsers.error', e);
      res.status(500).json({
        success: false,
        errorMsg: JSON.stringify(e),
      });
      return;
    }
    // Return the authorization URL to Jira.
    res.status(200).json({
      success: true,
      data: jiraUsers,
    });
  }
);

module.exports = {
  className: 'admin',
  routes: router,
};

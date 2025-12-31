import { Router } from 'express';
import prisma from '../../db/prisma';
import { ProjectStatus, RecordStatus, Team } from '@prisma/client';
import { ProfileResponse } from '../../types/response';
import { userProfileRequestHandler } from '../../lib/util';
import {
  CreateTeamInputSchema,
  TeamMember,
  TeamOutput,
  VisibleTeamMembers,
  getVisibleTeamsWhereClause,
} from '../types/teamTypes';
import {
  MilestonesAndBacklog,
  VisibleProjects,
} from '../types/projectIncludes';
import { VisibleIssues } from '../types/issueTypes';

const router = Router();
router.use(userProfileRequestHandler);

// Gets a specific team by ID
router.get(
  '/:teamId',
  async function (request, response: ProfileResponse<TeamOutput>) {
    const { userId, organizationId } = response.locals.currentUser;

    try {
      const { teamId } = request.params;
      if (!teamId) {
        throw new Error('You must specify a team ID');
      }

      const data = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          childTeams: {
            where: getVisibleTeamsWhereClause(userId),
          },
          members: {
            where: VisibleTeamMembers,
            include: { user: true },
          },
          projects: {
            where: VisibleProjects,
            include: {
              issues: { where: VisibleIssues },
              workPlans: { where: MilestonesAndBacklog },
              owner: true,
            },
          },
        },
      });

      if (!data || data.organizationId !== organizationId) {
        throw new Error('The specified team was not found: ' + teamId);
      }

      response.json({ success: true, data });
    } catch (error) {
      console.error('An error occurred in /team/id', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Create a new team
router.post('/', async function (request, response: ProfileResponse<Team>) {
  const { userId, organizationId } = response.locals.currentUser;

  try {
    const { members, ...input } = CreateTeamInputSchema.parse(request.body);
    const data = await prisma.team.create({
      data: {
        ...input,
        organizationId,
        members: members && {
          create: members?.map((userId) => ({ userId })),
        },
      },
    });

    response.status(200).json({ success: true, data });
  } catch (error) {
    console.error('An error occurred in POST /team', error);
    response
      .status(500)
      .json({ success: false, errorMsg: (error as string | Error).toString() });
  }
});

// Get the members of a specific team
router.get(
  '/:teamId/members',
  async function (request, response: ProfileResponse<TeamMember[]>) {
    try {
      const { teamId } = request.params;
      const data = await prisma.userTeam.findMany({
        where: {
          ...VisibleTeamMembers,
          teamId,
        },
        include: { user: true },
      });

      response.status(200).json({ success: true, data });
    } catch (error) {
      console.error('An error occurred in GET /team/:teamId/members', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

/**
 * Update a team
 */
router.put('/:teamId', async function (req, res: ProfileResponse<Team>) {
  const { teamId } = req.params;
  const { userId } = res.locals.currentUser;
  const { name, description } = req.body;

  try {
    const result = await prisma.team.update({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
      data: {
        name: name,
        description: description,
      },
    });

    if (!result) {
      res
        .status(401)
        .json({ success: false, errorMsg: 'User is not a team member' });
      return;
    }

    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('server.routes.api.team.put failure:', e);
    res.status(500).json({ success: false, errorMsg: e as string });
    return;
  }
});

/**
 * Delete a team
 */
router.delete('/:teamId', async function (req, res: ProfileResponse<null>) {
  const { teamId } = req.params;
  const { userId } = res.locals.currentUser;

  console.log('server.routes.api.team.delete.teamId', teamId);

  // Only allow deletion of a team if it has no child teams and no non-canceled projects
  try {
    const result = await prisma.team.update({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
        NOT: {
          childTeams: {
            some: {},
          },
        },
        projects: {
          every: {
            status: ProjectStatus.CANCELED,
          },
        },
      },
      data: {
        status: RecordStatus.DEACTIVATED,
      },
    });

    // Fail out if the user is not the project owner
    if (!result) {
      res.status(401).json({
        success: false,
        errorMsg:
          'Team can only be deleted if: user is a member, team has no child teams, and team has no projects',
      });
      return;
    }

    // Soft deletion of members
    await prisma.userTeam.updateMany({
      where: {
        ...VisibleTeamMembers,
        teamId,
      },
      data: {
        status: RecordStatus.DEACTIVATED,
      },
    });

    res.status(200).json({ success: true, data: null });
  } catch (e) {
    console.error('server.routes.api.projects.delete', e);
    res.status(500).json({ success: false, errorMsg: e as string });
  }
});

// Add an existing user to a team
router.put(
  '/:teamId/members/:userId',
  async function (request, response: ProfileResponse<TeamMember>) {
    const { organizationId } = response.locals.currentUser;
    try {
      const { teamId, userId } = request.params;
      if (!teamId || !userId) {
        throw new Error(
          'You must specify the teamId and the userId in the path'
        );
      }

      const [team, user] = await Promise.all([
        prisma.team.findUnique({ where: { id: teamId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ]);

      if (
        team?.organizationId !== organizationId ||
        user?.organizationId !== organizationId
      ) {
        throw new Error(
          'Either the specified team or user could not be found in the org'
        );
      }

      const data = await prisma.userTeam.upsert({
        where: {
          userId_teamId: { userId, teamId },
        },
        update: {},
        create: { userId, teamId },
        include: { user: true, team: true },
      });

      response.json({ success: true, data });
    } catch (error) {
      console.error(
        'An error occurred in /team/:teamId/members/:userId',
        error
      );
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

export const className = 'team';
export const routes = router;

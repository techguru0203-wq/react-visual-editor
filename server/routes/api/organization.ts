import { Request, Router } from 'express';
import prisma from '../../db/prisma';
import { ProfileResponse } from '../../types/response';
import {
  DOCTYPE,
  Organization,
  Prisma,
  TemplateAccess,
  TemplateDocument,
  TemplateStatus,
  User,
  UserRole,
} from '@prisma/client';
import { userProfileRequestHandler } from '../../lib/util';
import {
  OrganizationHierarchy,
  OrganizationWithContents,
  TeamAndProjects,
  TeamHierarchy,
} from '../types/organizationTypes';
import { VisibleUsers } from '../types/userTypes';
import {
  VisibleTeamMembers,
  getVisibleTeamsWhereClause,
} from '../types/teamTypes';
import { VisibleProjects } from '../types/projectIncludes';
import { PaginationQuery } from '../../types/request';
import {
  getVisibleProjectsForUser,
  getVisibleProjectsForUserLightweight,
} from '../../services/projectService';

const router = Router();
router.use(userProfileRequestHandler);

router.post(
  '/update',
  async function (request, response: ProfileResponse<Organization>) {
    try {
      const { size, industry, name, website, id, apiKey } = request.body;

      const updateData: any = {
        website,
        name,
        meta: {
          size,
          industry,
          name,
        },
      };

      // Only update apiKey if it's provided
      if (apiKey !== undefined) {
        updateData.apiKey = apiKey;
      }

      const organization = await prisma.organization.update({
        where: { id },
        data: updateData,
      });

      if (!organization) {
        throw new Error('The organization could not be found');
      }

      response.status(200).json({ success: true, data: organization });
    } catch (error) {
      console.error('Error in /organization', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
      return;
    }
  }
);

router.get(
  '/',
  userProfileRequestHandler,
  async function (
    request: Request,
    response: ProfileResponse<Organization | OrganizationWithContents>
  ) {
    try {
      const { userId, role, organizationId, email } =
        response.locals.currentUser;
      const { includeContents = false, lightweight = false } = request.query;

      // For lightweight mode (organization home page)
      if (includeContents && lightweight === 'true') {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
          include: {
            users: {
              where: VisibleUsers,
              select: { id: true, username: true, email: true },
            },
          },
        });

        if (!organization) {
          throw new Error('The organization could not be found');
        }

        // Fetch minimal project data with pagination
        const { projects, total, hasMore } =
          await getVisibleProjectsForUserLightweight({
            userId,
            organizationId,
            email,
            page,
            limit,
          });

        const organizationWithProjects = {
          ...organization,
          projects,
          pagination: {
            page,
            limit,
            total,
            hasMore,
          },
        } as unknown as OrganizationWithContents;

        response
          .status(200)
          .json({ success: true, data: organizationWithProjects });
        return;
      }

      // Original full mode (for other pages that need all data)
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: includeContents
          ? {
              users: { where: VisibleUsers },
              teams: {
                where: {
                  ...getVisibleTeamsWhereClause(
                    role === UserRole.ADMIN,
                    userId
                  ),
                  parentTeamId: null,
                },
                include: {
                  _count: {
                    select: {
                      childTeams: {
                        where: getVisibleTeamsWhereClause(
                          role === UserRole.ADMIN,
                          userId
                        ),
                      },
                      members: { where: VisibleTeamMembers },
                      projects: { where: VisibleProjects },
                    },
                  },
                },
              },
              specialties: { where: { status: 'active' } },
            }
          : undefined,
      });

      if (!organization) {
        throw new Error('The organization could not be found');
      }

      // If includeContents, load and filter projects manually
      if (includeContents) {
        const filteredProjects = await getVisibleProjectsForUser({
          userId,
          organizationId,
          email,
        });

        const organizationWithProjects = {
          ...organization,
          projects: filteredProjects,
        } as unknown as OrganizationWithContents;
        response
          .status(200)
          .json({ success: true, data: organizationWithProjects });
      } else {
        response.status(200).json({ success: true, data: organization });
      }
    } catch (error) {
      console.error('Error in /organization', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Get a list of users in the current user's organization
router.get(
  '/users',
  async function (request, response: ProfileResponse<ReadonlyArray<User>>) {
    const { organizationId } = response.locals.currentUser;
    const { excludeTeamId } = request.query as {
      excludeTeamId?: string | null;
    };

    const users = await prisma.user.findMany({
      where: {
        ...VisibleUsers,
        organizationId,
        ...(excludeTeamId
          ? { teams: { none: { teamId: excludeTeamId } } }
          : {}),
      },
    });
    response.status(200).json({ success: true, data: users });
  }
);

router.get(
  '/template-documents',
  async function (request, response: ProfileResponse<TemplateDocument[]>) {
    try {
      const { userId, organizationId } = response.locals.currentUser;

      if (!organizationId) {
        throw new Error('The organization could not be found');
      }

      const query = request.query as unknown as PaginationQuery &
        Record<string, string>;
      const q: string = query.q;
      const type: DOCTYPE = query.type as DOCTYPE;
      let page: number = Number(request.query.page) || 1;
      let limit: number = Number(request.query.limit) || 20;

      if (isNaN(page) || page <= 0) {
        throw new Error('Invalid page number');
      }

      if (isNaN(limit) || limit <= 0) {
        throw new Error('Invalid limit number');
      }
      if (!page || page < 1) {
        page = 1;
      }
      const skip = (page - 1) * limit;

      const conditions: Prisma.TemplateDocumentWhereInput = {
        AND: [
          {
            OR: [
              {
                creatorUserId: userId,
                access: TemplateAccess.SELF,
              },
              {
                organizationId,
                access: TemplateAccess.ORGANIZATION,
              },
              {
                access: TemplateAccess.PUBLIC,
              },
            ],
          },
        ],
        status: TemplateStatus.PUBLISHED,
      };
      if (type) {
        conditions.type = type;
      }
      if (Boolean(q)) {
        (conditions.AND as Prisma.TemplateDocumentWhereInput[]).push({
          OR: [
            {
              name: { contains: q, mode: 'insensitive' },
            },
            {
              description: { contains: q, mode: 'insensitive' },
            },
          ],
        });
      }

      const result = await prisma.templateDocument.findMany({
        where: conditions,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          organization: { select: { name: true } },
        },
      });
      const total = await prisma.templateDocument.count({
        where: conditions,
      });
      response.status(200).json({
        success: true,
        data: {
          list: result.sort((a, b) => {
            if (
              b.access === TemplateAccess.SELF ||
              (b.access === TemplateAccess.ORGANIZATION &&
                a.access === TemplateAccess.PUBLIC)
            ) {
              return 1;
            }
            return -1;
          }),
          pagination: {
            page,
            limit,
            total,
          },
        },
      });
    } catch (error) {
      console.error('Error in GET /organization/template-documents', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Get information about the current organization, as well as a list of teams and projects the user can see within it
router.get(
  '/hierarchy',
  async function (
    request: Request,
    response: ProfileResponse<OrganizationHierarchy>
  ) {
    const { userId, email, role, organizationId } = response.locals.currentUser;
    // Support pagination query params (optional, defaults to first page with reasonable limit)
    const page = parseInt(request.query.page as string) || 1;
    const limit = Math.min(parseInt(request.query.limit as string) || 25, 100); // Max 100 projects per request

    try {
      // Fetch organization and teams in parallel with projects query
      // Don't include projects in teams query since we fetch them separately (lighter query)
      const [organizationResult, projectsResult] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          include: {
            teams: {
              where: getVisibleTeamsWhereClause(
                role === UserRole.ADMIN,
                userId
              ),
              // Only include minimal project info (just IDs for reference) to keep query light
              select: {
                id: true,
                name: true,
                description: true,
                parentTeamId: true,
                organizationId: true,
                createdAt: true,
                updatedAt: true,
                status: true,
                meta: true,
                projects: {
                  where: VisibleProjects,
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    status: true,
                  },
                },
              },
            },
          },
        }),
        getVisibleProjectsForUserLightweight({
          userId,
          organizationId,
          email,
          page,
          limit,
        }),
      ]);

      if (!organizationResult) {
        throw new Error('Information about the organization failed to load');
      }

      const { teams: flatTeamList, ...organization } = organizationResult;

      // Build team hierarchy (teams already have minimal project info)
      // Cast to TeamAndProjects since we're using select with minimal fields
      const teams = flatTeamList
        .filter((t) => !t.parentTeamId)
        .map((t) =>
          addChildrenToTeam(
            t as unknown as TeamAndProjects,
            flatTeamList as unknown as ReadonlyArray<TeamAndProjects>
          )
        );

      const data = {
        ...organization,
        projects: projectsResult.projects,
        teams,
      };
      response.status(200).json({ success: true, data });
    } catch (error) {
      console.error('An error occurred in /organization/hierarchy', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

function addChildrenToTeam(
  team: TeamAndProjects,
  flatTeamList: ReadonlyArray<TeamAndProjects>
): TeamHierarchy {
  return {
    ...team,
    teams: flatTeamList
      .filter((t) => t.parentTeamId === team.id)
      .map((childTeam) => addChildrenToTeam(childTeam, flatTeamList)),
  };
}

export const className = 'organization';
export const routes = router;

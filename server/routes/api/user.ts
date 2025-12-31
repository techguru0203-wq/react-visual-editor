import { Request, Router } from 'express';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { fromEnv } from '@aws-sdk/credential-providers';

import { AuthenticatedResponse, ProfileResponse } from '../../types/response';
import {
  CognitoUserAttributes,
  InviteUserResponse,
  UserInviteInputSchema,
  UserProfile,
  UserProfileInputSchema,
} from '../types/userTypes';
import { userProfileRequestHandler } from '../../lib/util';
import prisma from '../../db/prisma';
import { Prisma, RecordStatus, UserRole } from '@prisma/client';
import { filterUserProfileData } from '../../services/userService';
import {
  DEFAULT_DEV_VELOCITY,
  OMNIFLOW_INVITEE_MAX_COUNT,
  OMNIFLOW_INVITER_EMAIL,
} from '../../lib/constant';
import {
  updateOrgCreditsAfterUserInvite,
  updateOrgCreditsReFill,
} from '../../services/creditService';
import mixpanel from '../../services/trackingService';
import { chatAIMessage } from '../../services/llmService/uiux/ai_utils';

const router = Router();

const userPool = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
  credentials: fromEnv(), // Reads AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY
});

// Get user's full profile
router.get(
  '/profile/:id?',
  async function (request, response: AuthenticatedResponse<UserProfile>) {
    const currentUser = response.locals.currentUser;
    let { id }: { id?: string } = request.params;
    if (!id) {
      id = currentUser.userId;
    }
    const existingProfile = await prisma.user.findUnique({
      where: { id: id },
      include: {
        organization: true,
      },
    });
    if (existingProfile) {
      try {
        updateOrgCreditsReFill(
          id,
          existingProfile.organization.id,
          existingProfile.email,
          existingProfile.firstname
        );
      } catch (e) {
        console.error('Error refill credit daily', e);
        response.status(200).json({
          success: false,
          errorMsg: (e as string | Error).toString(),
        });
        return;
      }

      response.status(200).json({
        success: true,
        data: filterUserProfileData(existingProfile),
      });
      return;
    } else {
      console.log('User profile not found for this userId: ' + id);
      response.status(500).json({
        success: false,
        errorMsg: 'This user was not found in our database: ' + id,
      });
      return;
    }
  }
);

// Update or create the current user's profile
router.put(
  '/profile',
  async function (request, response: AuthenticatedResponse<UserProfile>) {
    const currentUser = response.locals.currentUser;
    const parseResult = UserProfileInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      console.log(
        'Failure when parsing the input to save a user profile',
        parseResult.error
      );
      response
        .status(500)
        .json({ success: false, errorMsg: parseResult.error.toString() });
      return;
    }

    const {
      id,
      organizationId,
      email,
      jiraId,
      enableProposalGen,
      sampleTaskStoryPoint,
      documentGenerateLang,
      referalSource,
      neededHelp,
      ...mutableFields
    } = parseResult.data;
    const currentUserProfile = await prisma.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (id !== currentUser.userId && currentUserProfile?.role !== 'ADMIN') {
      console.error("You don't have permission to edit other user's profile.");
      response.status(401).json({
        success: false,
        errorMsg: "You don't have permission to edit other user's profile.",
      });
      return;
    }

    const cognitoUser = await findCognitoUser(
      currentUserProfile?.googleAuthId || id
    );
    if (cognitoUser === undefined) {
      console.error('Cognito user not found for: ' + id);
      response.status(500).json({
        success: false,
        errorMsg: 'This user was not set up correctly.',
      });
      return;
    }
    const rawSqlResult = await upsertUserProfileInPrisma(
      id,
      organizationId,
      email,
      cognitoUser,
      currentUserProfile?.status || RecordStatus.ACTIVE,
      jiraId,
      enableProposalGen as boolean,
      referalSource as string,
      neededHelp as string,
      mutableFields
    );

    if (currentUserProfile?.role == 'ADMIN') {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      let meta: any = organization?.meta || {};
      if (sampleTaskStoryPoint !== undefined) {
        meta.sampleTaskStoryPoint = sampleTaskStoryPoint;
      }
      if (documentGenerateLang != undefined) {
        meta.documentGenerateLang = documentGenerateLang;
      }
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          meta: meta,
        },
      });
    }

    response.status(200).json({
      success: true,
      data: filterUserProfileData(rawSqlResult),
    });
  }
);

// Invite a new user to the organization
router.post(
  '/invite',
  userProfileRequestHandler,
  async function (
    request: Request,
    response: ProfileResponse<InviteUserResponse>
  ) {
    const { organizationId, email: inviterEmail } = response.locals.currentUser;

    // Sanity check on request body.
    const parsedResult = UserInviteInputSchema.safeParse(request.body);
    if (!parsedResult.success) {
      console.error(
        'Invalid input specified for /profile/invite',
        parsedResult.error
      );
      response
        .status(500)
        .json({ success: false, errorMsg: parsedResult.error.toString() });
      return;
    }

    // TODO: clean up the following logics.

    // For each email, create a new user in the user pool & databse separately.
    const { emails, initialTeamId } = parsedResult.data;
    const successfulEmails: string[] = [];
    const failedEmails: string[] = [];
    for (const email of emails) {
      console.log('Inviting user with email: ' + email);
      let cognitoUser = await findCognitoUser(email);

      if (cognitoUser) {
        console.log('Found user in Cognito: ' + email);
      } else {
        if (
          (await createCognitoUser(
            email,
            organizationId,
            initialTeamId ?? undefined
          )) === false
        ) {
          console.log('Failed to create this user in Cognito: ' + email);
          failedEmails.push(email);
          continue;
        } else {
          cognitoUser = await findCognitoUser(email);
        }
      }
      if (!cognitoUser) {
        console.log('Failed to find user in Cognito: ' + email);
        failedEmails.push(email);
        continue;
      }
      let uuid = cognitoUser.userId;
      const existedUser = await findUserProfileInPrisma(email);
      // If pending user exists and with different id, this must be dirty data.
      if (
        existedUser &&
        existedUser.status === RecordStatus.PENDING &&
        existedUser.id != uuid
      ) {
        console.log(
          'user id mismatch:',
          existedUser.id,
          '!=',
          cognitoUser.userId
        );
        console.log('Please clean up dirty data for email: ' + email);
        failedEmails.push(email);
        continue;
      }

      // If user is not at pending status. This must be an invalid invitation.
      if (existedUser && existedUser.status !== RecordStatus.PENDING) {
        console.log('This user has already finished registration : ' + email);
        failedEmails.push(email);
        continue;
      }

      // find org data
      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: {
          availableSeats: {
            decrement: 1,
          },
        },
      });
      // Insert / update the pending user data.
      let updatedUserProfile = await upsertUserProfileInPrisma(
        uuid,
        organizationId,
        email,
        cognitoUser,
        RecordStatus.ACTIVE,
        null,
        false,
        '',
        '',
        {
          firstname: '',
          lastname: '',
          username: email,
          subscriptionTier: organization?.subscriptionTier,
          subscriptionStatus: organization?.subscriptionStatus,
          inviterEmail,
        }
      );
      if (!updatedUserProfile) {
        console.log('Failed to create this user in DB: ' + email);
        failedEmails.push(email);
        continue;
      }
      console.log('Successfully upserted user = ', updatedUserProfile);
      successfulEmails.push(email);
      // track successful invitation
      mixpanel.track('User Invited', {
        distinct_id: email,
        inviterEmail,
        organizationId,
      });
    }

    response.status(200).json({
      success: true,
      data: {
        successfulEmails: successfulEmails,
        failedEmails: failedEmails,
      },
    });
  }
);

// Invite a new user to the organization
router.post(
  '/virtual',
  userProfileRequestHandler,
  async function (
    request: Request,
    response: ProfileResponse<Partial<UserProfile>>
  ) {
    const {
      organizationId,
      email: inviterEmail,
      userId,
    } = response.locals.currentUser;

    const { firstname, lastname, velocity, specialty } = request.body;

    // Insert / update the pending user data.
    let result;
    try {
      result = await prisma.user.create({
        data: {
          email: `${firstname}.${lastname}+${new Date().getTime()}@gmail.com`,
          username: `${firstname} ${lastname}`,
          firstname,
          lastname,
          organizationId,
          role: UserRole.VIRTUALEMPLOYEE,
          specialty,
          velocity: velocity - 0,
          meta: {
            creatorUserId: userId,
            inviterEmail,
          },
        },
      });
    } catch (e) {
      console.error('Error creating virtual user', e);
    }
    console.log('Successfully crated virtual user = ', result);
    // track successful invitation
    mixpanel.track('Virtual User Created', {
      distinct_id: result?.email,
      inviterEmail,
      organizationId,
    });

    response.status(200).json({
      success: true,
      data: {
        id: result?.id as string,
        email: result?.email as string,
      },
    });
  }
);

// Invite a new user to the organization
router.post(
  '/confirmInvitation',
  userProfileRequestHandler,
  async function (
    request: Request,
    response: ProfileResponse<Partial<UserProfile>>
  ) {
    const { userId, email: inviteeEmail } = response.locals.currentUser;

    const { inviterEmail } = request.body;

    let inviterConfirmed = false;
    let inviter;
    let inviterMeta: Prisma.JsonObject = {};
    try {
      if (inviterEmail === OMNIFLOW_INVITER_EMAIL) {
        console.log(
          'Inviter email is Omniflow, skipping confirmation:',
          inviterEmail
        );
        inviterConfirmed = true;
      } else {
        inviter = await prisma.user.findFirst({
          where: { email: inviterEmail, status: RecordStatus.ACTIVE },
        });
        if (!inviter) {
          console.log('Inviter not found:', inviterEmail);
          // track failed invitation
          mixpanel.track('confirmUserInvitationFailure', {
            distinct_id: inviteeEmail,
            inviterEmail,
            error: 'Inviter not found',
          });
          throw 'Inviter not found for ' + inviterEmail;
        }
        inviterMeta = (inviter.meta as Prisma.JsonObject) || inviterMeta;
        inviterConfirmed =
          !inviterMeta.inviteeCount ||
          Number(inviterMeta.inviteeCount) < OMNIFLOW_INVITEE_MAX_COUNT;
        if (!inviterConfirmed) {
          console.error('Inviter has reached the limit:', inviterEmail);
          // track failed invitation
          mixpanel.track('confirmUserInvitationFailure', {
            distinct_id: inviteeEmail,
            inviterEmail,
            error: 'Inviter has reached the limit',
          });
          throw `Inviter has used up all ${OMNIFLOW_INVITEE_MAX_COUNT} invitees.`;
        }
      }
    } catch (e) {
      response.status(200).json({
        success: false,
        errorMsg: (e as string | Error).toString(),
      });
      return;
    }
    // update inviter data
    try {
      // update invitee
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: RecordStatus.ACTIVE,
        },
      });
      if (inviterEmail !== OMNIFLOW_INVITER_EMAIL) {
        // update inviter count of invitee
        const inviter = await prisma.user.update({
          where: { email: inviterEmail, status: RecordStatus.ACTIVE },
          data: {
            meta: {
              ...inviterMeta,
              inviteeCount: (Number(inviterMeta.inviteeCount) || 0) + 1,
            },
          },
        });
        // reward inviter
        updateOrgCreditsAfterUserInvite(inviter, inviteeEmail);
      }
    } catch (e) {
      console.error('Error update inviter/invitee after confirmation', e);
      response.status(200).json({
        success: false,
        errorMsg: (e as string | Error).toString(),
      });
      return;
    }
    console.log('Successfully confirmed user invitee ', inviteeEmail);
    response.status(200).json({
      success: true,
      data: {
        email: inviteeEmail,
      },
    });
  }
);

router.post(
  '/companyInfo',
  userProfileRequestHandler,
  async (request, response) => {
    try {
      let { website } = request.body;
      let websiteMessage = website;
      if (!website?.startsWith('http://') && !website?.startsWith('https://')) {
        websiteMessage = 'http://' + website + ' or ' + 'https://' + website;
      }
      const currentUser = response.locals.currentUser;
      let aiRes = await chatAIMessage(
        `based on the website information ${websiteMessage}, please analyze it and do the best estimate on company name, company size and industry and return in JSON format`,
        currentUser
      );
      if (aiRes?.content) {
        let jsonObj = null;
        const jsonMatch = aiRes?.content.match(/```json\n({[\s\S]*?})\n```/);
        let targetJson = jsonMatch[1].trim();
        console.log(
          `in router.user.CompanyInfo.website:${website}`,
          targetJson
        );
        if (jsonMatch) {
          jsonObj = JSON.parse(targetJson);
        }
        console.log('in router.user.CompanyInfo.jsonObj: ' + jsonObj);
        let { company_name, company_size, industry } = jsonObj;
        response.status(200).json({
          success: true,
          data: {
            name: company_name,
            size: company_size,
            industry,
          },
        });
      } else {
        response
          .status(200)
          .json({ success: false, errorMsg: 'openAI Response failed!' });
      }
    } catch (error: any) {
      console.error('Error in router.user.CompanyInfo', error);
      response.status(500).json({ success: false, errorMsg: error.toString() });
    }
  }
);

async function findCognitoUser(
  username: string
): Promise<CognitoUserAttributes | undefined> {
  const command = new AdminGetUserCommand({
    UserPoolId: process.env.REACT_APP_USER_POOL_ID,
    Username: username,
  });
  try {
    const cognitoUser = await userPool.send(command);

    console.log(
      'Got the following attributes from cognito for Username:',
      username,
      cognitoUser.UserAttributes
    );
    const email = (cognitoUser.UserAttributes || []).find(
      (a) => a.Name === 'email'
    )?.Value;
    const organizationId = (cognitoUser.UserAttributes || []).find(
      (a) => a.Name === 'custom:organizationId'
    )?.Value;
    const initialTeamIds = (cognitoUser.UserAttributes || []).find(
      (a) => a.Name === 'custom:initialTeamIds'
    )?.Value;

    if (!email || !cognitoUser.Username) {
      throw new Error(
        'Incomplete cognito user for this user: ' + cognitoUser.Username
      );
    }
    return {
      userId: cognitoUser.Username,
      email,
      organizationId,
      initialTeamIds: initialTeamIds
        ? (JSON.parse(initialTeamIds) as string[])
        : [],
    };
  } catch (error) {
    if (error instanceof UserNotFoundException) {
      return undefined;
    }
    console.error('An error occurred while looking for a cognito user', error);
    throw error;
  }
}

async function createCognitoUser(
  email: string,
  organizationId: string,
  initialTeamId?: string
): Promise<boolean> {
  const createCommand = new AdminCreateUserCommand({
    UserPoolId: process.env.REACT_APP_USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'custom:organizationId', Value: organizationId },
      {
        Name: 'custom:initialTeamIds',
        Value: JSON.stringify(initialTeamId ? [initialTeamId] : []),
      },
    ],
  });
  try {
    const result = await userPool.send(createCommand);
    if (!result.User?.Username) {
      console.error('Failed to create this user in Cognito: ' + email);
      return false;
    }
  } catch (error) {
    console.error(
      'An error occurred while creating this user in the user pool: ' + email,
      error
    );
    return false;
  }
  // track successful invitation
  mixpanel.track('Cognito User Created', {
    distinct_id: email,
    organizationId,
  });
  return true;
}

async function upsertUserProfileInPrisma(
  id: string,
  organizationId: string,
  email: string,
  cognitoUser: CognitoUserAttributes | undefined,
  userStatus: RecordStatus,
  jiraId: string | null | undefined, //  null = set to null, undefined = keep the same
  enableProposalGen: boolean | undefined,
  referalSource: string,
  neededHelp: string,
  mutableFields: any
): Promise<any> {
  if (cognitoUser === undefined) {
    return undefined;
  }
  const existingProfile = await prisma.user.findUnique({
    where: { id: id },
  });

  let meta: any = existingProfile?.meta || {};
  if (jiraId !== undefined) {
    let { jira_profile } = meta;
    jira_profile = jira_profile ?? { account_id: jiraId };
    jira_profile.account_id = jiraId;
    meta.jira_profile = jira_profile;
  }

  let inviterEmail = mutableFields.inviterEmail;
  delete mutableFields.inviterEmail;
  if (inviterEmail) {
    meta.inviterEmail = inviterEmail;
  }
  if (enableProposalGen !== undefined) {
    meta.enableProposalGen = enableProposalGen;
  }
  if (referalSource) {
    meta.referalSource = referalSource;
  }
  if (neededHelp) {
    meta.neededHelp = neededHelp;
  }

  console.log('in upsertUserProfileInPrisma:', meta);

  return await prisma.user.upsert({
    where: { id },
    update: {
      ...mutableFields,
      status: userStatus,
      id,
      email,
      organization: { connect: { id: organizationId } },
      meta,
    },
    create: {
      ...mutableFields,
      status: userStatus,
      id,
      email,
      velocity: DEFAULT_DEV_VELOCITY,
      organization: { connect: { id: organizationId } },
      meta,
      ...(cognitoUser.initialTeamIds.length
        ? {
            teams: {
              create: cognitoUser.initialTeamIds.map((teamId: string) => ({
                teamId,
              })),
            },
          }
        : {}),
    },
  });
}

async function findUserProfileInPrisma(email: string): Promise<any> {
  return await prisma.user.findUnique({
    where: { email: email },
  });
}

export const className = 'user';
export const routes = router;

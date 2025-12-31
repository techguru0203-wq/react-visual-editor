import { UserProfile } from '../routes/types/userTypes';
import { TokenResponse } from './jiraService';
import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { JiraResource, JiraUserProfile } from '../../shared/types/jiraTypes';
import { GithubUserProfile } from '../../shared/types/githubTypes';

export function filterUserProfileData(rawProfile: any): UserProfile {
  const { role, ...profileWithoutRole } = rawProfile;
  const jiraEnabled = !!profileWithoutRole.meta?.hasOwnProperty('jira_tokens');
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const isReferralEnabled = profileWithoutRole.meta?.isReferralEnabled;

  // Remove Secret Meta Data.
  if (jiraEnabled) {
    delete profileWithoutRole.meta.jira;
  }

  return {
    ...profileWithoutRole,
    firstname: profileWithoutRole.firstname.trim(),
    lastname: profileWithoutRole.lastname.trim(),
    isAdmin,
    isReferralEnabled,
    jiraEnabled,
    role, // Include role in the response
    referralCode: profileWithoutRole.referralCode || null, // Include referral code
  };
}

export async function saveJiraUserInformation(
  userUuid: string,
  tokens: TokenResponse,
  profile: JiraUserProfile | null
): Promise<any> {
  console.log('Saving Jira data for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });

  // Update Jira information only.
  let newMeta = (user?.meta as Prisma.JsonObject) ?? {};
  newMeta.jira_tokens = tokens;
  // Keep old profile when updating tokens.
  if (profile !== null) {
    newMeta.jira_profile = profile;
  }

  return await prisma.user.update({
    where: {
      id: userUuid,
    },
    data: {
      jiraUserId: profile?.account_id,
      meta: newMeta,
    },
  });
}

export async function saveJiraResource(
  userUuid: string,
  jiraResource: JiraResource
): Promise<any> {
  console.log('Saving Jira cloudId for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });

  let newMeta = (user?.meta as Prisma.JsonObject) ?? {};
  (newMeta.jira_profile as JiraUserProfile).resource = jiraResource;

  return await prisma.user.update({
    where: {
      id: userUuid,
    },
    data: {
      meta: newMeta,
    },
  });
}

export async function readJiraUserProfile(
  userUuid: string
): Promise<JiraUserProfile> {
  console.log('Read Jira profile for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });

  // Update Jira information only.
  let meta = (user?.meta as Prisma.JsonObject) ?? {};
  if (meta.jira_profile) {
    return meta.jira_profile as JiraUserProfile;
  } else {
    throw new Error('Jira profile does not exist');
  }
}

export async function getUsersForProject(projectId: string): Promise<any[]> {
  const projectInfo = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });
  if (!projectInfo?.organizationId) {
    throw new Error("Project's organizationId not found");
  }
  const users = await prisma.user.findMany({
    where: {
      organizationId: projectInfo?.organizationId,
    },
  });

  return users.map((user) => {
    const meta = user?.meta as any;
    const account_id = meta?.jira_profile?.account_id || null;
    return { willyId: user.id, jiraId: account_id };
  });
}

export async function saveGithubUserInformation(
  userUuid: string,
  profile: GithubUserProfile | null
): Promise<any> {
  console.log('Saving github data for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });

  // Update Jira information only.
  let newMeta = (user?.meta as Prisma.JsonObject) ?? {};
  // Keep old profile when updating tokens.
  if (profile !== null) {
    newMeta.github_profile = profile;
  }

  return await prisma.user.update({
    where: {
      id: userUuid,
    },
    data: {
      meta: newMeta,
    },
  });
}

export async function deleteGithubUserInformation(
  userUuid: string
): Promise<any> {
  console.log('Deleting github data for user:', userUuid);

  const user = await prisma.user.findUnique({
    where: { id: userUuid },
  });

  if (!user) throw new Error('User not found');

  let newMeta = { ...(user.meta as Prisma.JsonObject) };
  delete newMeta.github_profile;

  return await prisma.user.update({
    where: { id: userUuid },
    data: { meta: newMeta },
  });
}

export async function getUserGithubProfile(
  userUuid: string
): Promise<GithubUserProfile> {
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });
  if (!user) {
    throw new Error('User not found');
  }
  const meta = user.meta as Prisma.JsonObject;
  return meta.github_profile as GithubUserProfile;
}

export async function saveBitbucketUserInformation(
  userUuid: string,
  profile: any
): Promise<any> {
  console.log('Saving bitbucket data for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: { id: userUuid },
  });
  let newMeta = (user?.meta as Prisma.JsonObject) ?? {};
  if (profile !== null) {
    newMeta.bitbucket_profile = profile;
  }
  return await prisma.user.update({
    where: { id: userUuid },
    data: { meta: newMeta },
  });
}

export async function deleteBitbucketUserInformation(
  userUuid: string
): Promise<any> {
  console.log('Deleting bitbucket data for user:', userUuid);
  const user = await prisma.user.findUnique({
    where: { id: userUuid },
  });
  if (!user) throw new Error('User not found');
  let newMeta = { ...(user.meta as Prisma.JsonObject) };
  delete newMeta.bitbucket_profile;
  return await prisma.user.update({
    where: { id: userUuid },
    data: { meta: newMeta },
  });
}

export async function getUserBitbucketProfile(userUuid: string): Promise<any> {
  const user = await prisma.user.findUnique({
    where: { id: userUuid },
  });
  if (!user) {
    throw new Error('User not found');
  }
  const meta = user.meta as Prisma.JsonObject;
  return meta.bitbucket_profile;
}

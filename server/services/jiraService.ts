import { URL } from 'url';
import { SERVER_BASE_URL } from '../../shared/constants';
import axios, { AxiosResponse, AxiosError } from 'axios';
import prisma from '../db/prisma';
import { Issue, Prisma, WorkPlan } from '@prisma/client';
import {
  JiraResource,
  JiraUserProfile,
  JiraEntity,
} from '../../shared/types/jiraTypes';
import { saveJiraUserInformation } from './userService';

// Constants
export const NONCE_TTL_IN_SEC = 600;
export const REDIS_PREFIX_JIRA = 'jira_nonce_';

// Secrets of the app created in Atlassian Console.
const CLIENT_ID = process.env.JIRA_CLIENT_ID;
const CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;

export const CALLBACK_URL = SERVER_BASE_URL + '/api/callback/jira';

// URLs
const AUTHORIZATION_ENDPOINT = 'https://auth.atlassian.com/authorize';
const USER_PROFILE_ENDPOINT = 'https://api.atlassian.com/me';
const TOKEN_EXCHANGE_ENDPOINT = 'https://auth.atlassian.com/oauth/token';

// Templates
const KANBAN_TEMPLATE = {
  projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
  projectTypeKey: 'software',
};

const SCRUM_TEMPLATE = {
  projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic',
  projectTypeKey: 'software',
};

const QUERY_PARAMS = {
  audience: 'api.atlassian.com',
  client_id: CLIENT_ID,
  scope:
    'offline_access read:me read:account read:jira-work manage:jira-project manage:jira-configuration read:jira-user write:jira-work manage:jira-webhook manage:jira-data-provider read:sprint:jira-software write:sprint:jira-software write:board-scope:jira-software read:board-scope:jira-software read:project:jira read:screen:jira write:screen:jira write:issue-type-screen-scheme:jira read:issue-type-screen-scheme:jira read:screen-scheme:jira write:screen-scheme:jira read:screen-tab:jira write:screen-tab:jira read:screenable-field:jira write:screenable-field:jira',
  redirect_uri: CALLBACK_URL,
  response_type: 'code',
  prompt: 'consent',
};

export const generateAuthorizationURL = function (nonce: string): string {
  let params: { [key: string]: string | undefined } = QUERY_PARAMS;
  params['state'] = nonce;
  const url = new URL(AUTHORIZATION_ENDPOINT);
  // Adding query parameters
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value != undefined) {
      url.searchParams.append(key, value);
    }
  });
  return url.href;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
};

export const exchangeAccessAndRefreshTokens = async function (
  code: string
): Promise<TokenResponse> {
  const requestBody = {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: CALLBACK_URL,
  };

  console.log('=====>:', CALLBACK_URL, requestBody);
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  return axios
    .post(TOKEN_EXCHANGE_ENDPOINT, JSON.stringify(requestBody), config)
    .then((response: AxiosResponse) => {
      const { access_token, refresh_token } = response.data;
      if (!access_token || !refresh_token) {
        console.error(
          'server.jiraService.exchangeAccessAndRefreshTokens.error:' +
            'failed to retrieve access_token or refresh_token from response. response = ' +
            JSON.stringify(response.data)
        );
        throw new Error('Failed to retrieve access_token or refresh_token');
      }
      return { access_token, refresh_token };
    })
    .catch((error: AxiosError) => {
      console.error(
        'server.jiraService.exchangeAccessAndRefreshTokens.error:',
        error
      );
      throw error;
    });
};

export const fetchJiraUserProfile = async function (
  accessToken: string
): Promise<JiraUserProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  return axios
    .get(USER_PROFILE_ENDPOINT, {
      headers: headers,
    })
    .then((response: AxiosResponse) => {
      return response.data;
    })
    .catch((error: AxiosError) => {
      console.error('server.jiraService.fetchJiraUserProfile.error:', error);
      throw error;
    });
};

// Read the stored Jira tokens from the database.
async function getJiraTokens(userUuid: string): Promise<TokenResponse> {
  const user = await prisma.user.findUnique({
    where: {
      id: userUuid,
    },
  });

  // Update Jira information only.
  let meta = (user?.meta as Prisma.JsonObject) ?? {};
  return meta.jira_tokens as TokenResponse;
}

async function refreshExpiredAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const requestBody = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  };

  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  return axios
    .post(TOKEN_EXCHANGE_ENDPOINT, JSON.stringify(requestBody), config)
    .then((response: AxiosResponse) => {
      const { access_token, refresh_token } = response.data;
      if (!access_token || !refresh_token) {
        console.error(
          'server.jiraService.refreshExpiredAccessToken.error:' +
            'failed to retrieve access_token or refresh_token from response. response = ' +
            response.data
        );
        throw new Error('Failed to retrieve access_token or refresh_token');
      }
      return { access_token, refresh_token };
    })
    .catch((error: AxiosError) => {
      console.error(
        'server.jiraService.refreshExpiredAccessToken.error:',
        error
      );
      throw error;
    });
}

export async function getAccessToken(userUuid: string): Promise<string | null> {
  const tokens = await getJiraTokens(userUuid);
  if (!tokens) {
    return null;
  } else {
    return tokens.access_token;
  }
}

export async function updateAccessToken(userUuid: string) {
  const oldToken = await getJiraTokens(userUuid);
  const newTokens = await refreshExpiredAccessToken(oldToken.refresh_token);
  await saveJiraUserInformation(userUuid, newTokens, null);
}

export async function getJiraDataWithValidToken<T>(
  func: () => Promise<T>,
  userUuid: string
): Promise<T> {
  try {
    console.log('server.jiraService.getJiraDataWithValidToken.func:', func);
    return await func();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError: AxiosError = error;
      if (axiosError.response?.status === 401) {
        console.log(
          'Received 401 error. Refreshing access token and retrying...'
        );
        await updateAccessToken(userUuid);
        return await func();
      }
    }
    throw error;
  }
}

export const getJiraResource = async function (
  userUuid: string
): Promise<JiraResource[]> {
  const accessToken = await getAccessToken(userUuid);
  if (accessToken == null) {
    console.log('No jira access token found for user ' + userUuid);
    return [];
  }
  console.log('server.jiraService.getJiraResource.accessToken:', accessToken);
  try {
    const response = await axios.get(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    return response.data;
  } catch (e) {
    console.error('server.jiraService.getJiraResource.error:', e);
    throw e;
  }
};

function keepAlphabetAndDigtal(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '');
}
// TODO: replace it by the shortname defined by user.
export const generateKey = function (projectName: string): string {
  const words = projectName.split(' ');
  let key = '';
  if (words.length === 1) {
    key = keepAlphabetAndDigtal(words[0]).toUpperCase();
  } else {
    for (let i = 0; i < words.length; i++) {
      const word = keepAlphabetAndDigtal(words[i]);
      if (word.length > 0) {
        key += word[0].toUpperCase();
      }
    }
  }
  return key.substring(0, 10);
};

function isProjectKeyError(error: AxiosError<any>): boolean {
  const { errors } = error.response?.data;
  return errors?.projectKey?.includes('uses this project key');
}

function isProjectNameError(error: AxiosError<any>): boolean {
  const { errors } = error.response?.data;
  return errors?.projectName?.includes(
    'A project with that name already exists.'
  );
}

export const createSprintForBoard = async function (
  willySprint: WorkPlan,
  willyUserUuid: string,
  jiraResourceId: string,
  jiraBoardId: number
): Promise<any> {
  if (
    willySprint.plannedStartDate == null ||
    willySprint.plannedEndDate == null
  ) {
    throw new Error(
      'Sprint start date or end date is null! Sprint id = ' + willySprint.id
    );
  }
  const accessToken = await getAccessToken(willyUserUuid);
  const bodyData = {
    endDate: `${willySprint.plannedEndDate.toISOString()}`,
    goal: willySprint.description,
    name: willySprint.name,
    originBoardId: jiraBoardId,
    startDate: `${willySprint.plannedStartDate.toISOString()}`,
  };
  const response = await axios.post(
    'https://api.atlassian.com/ex/jira/' +
      jiraResourceId +
      '/rest/agile/1.0/sprint',
    bodyData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );
  return response?.data;
};

export const getSprintAndStoryPointsFieldIds = async function (
  willyUserUuid: string,
  jiraResourceId: string
): Promise<{ sprintFieldId: string; storyPointsFieldId: string }> {
  const accessToken = await getAccessToken(willyUserUuid);
  try {
    const response = await axios.get(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/api/3/field',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    const fields = response?.data;
    let sprintFieldId = null;
    let storyPointsFieldId = null;
    // TODO: check if we can fetch those here as well
    let issueTypeFieldIds = [];

    for (const field of fields) {
      if (field?.name === 'Sprint') {
        sprintFieldId = field.id;
      } else if (field?.name === 'Story Points') {
        storyPointsFieldId = field.id;
      }
    }
    if (sprintFieldId === null) {
      throw new Error(
        'server.routes.api.admin.getSprintAndStoryPointsFieldIds.error: Sprint field not found!'
      );
    }
    return {
      sprintFieldId,
      storyPointsFieldId,
    };
  } catch (error) {
    console.error(
      'server.jiraService.getSprintAndStoryPointsFieldIds.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const createFilterForProject = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  jiraProjectKey: string
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  const bodyData = {
    description: 'Filter for project ' + jiraProjectKey,
    jql: `project =${jiraProjectKey} and issuetype in (Sub-task, Story)`,
    // jql: `project = ${jiraProjectKey}`,
    name: 'All tasks and stories for project ' + jiraProjectKey,
  };

  try {
    const response = await axios.post(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/api/3/filter',
      bodyData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    return response?.data;
  } catch (error) {
    console.error(
      'server.jiraService.createFilterForProject.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const getBoardsOfProject = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  jiraProjectKey: string
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  try {
    const response = await axios.get(
      `https://api.atlassian.com/ex/jira/${jiraResourceId}/rest/agile/1.0/board`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        params: {
          projectKeyOrId: jiraProjectKey,
        },
      }
    );
    return response?.data;
  } catch (error) {
    console.error(
      'server.jiraService.getBoardsOfProject.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const createBoardForProject = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  jiraProjectKey: string,
  jiraFilterId: number,
  boardName: string,
  boardType: string
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  const bodyData = {
    filterId: jiraFilterId,
    location: {
      projectKeyOrId: jiraProjectKey,
      type: 'project',
    },
    name: boardName,
    type: boardType,
  };
  try {
    const response = await axios.post(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/agile/1.0/board',
      bodyData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    return response?.data;
  } catch (error) {
    console.error(
      'server.jiraService.createBoardForProject.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const createJiraProject = async function (
  projectName: string,
  userUuid: string,
  jiraProfile: JiraUserProfile
): Promise<any> {
  console.log('create Jira Project for user:', userUuid);
  const accessToken = await getAccessToken(userUuid);

  const key = generateKey(projectName);
  let bodyData = {
    key: key,
    name: projectName,
    leadAccountId: jiraProfile.account_id,
    projectTemplateKey: SCRUM_TEMPLATE.projectTemplateKey,
    projectTypeKey: SCRUM_TEMPLATE.projectTypeKey,
  };

  let randomSuffix = false;
  let randomSuffixForName = false;
  let retryTimes = 0;
  // Retry creating project with random suffix in key.
  while (retryTimes < 3) {
    try {
      const suffix = Math.floor(Math.random() * 1000).toString();
      if (randomSuffix) {
        bodyData.key = (key.substring(0, 10) + suffix).substring(0, 10);
      }
      if (randomSuffixForName) {
        bodyData.name = projectName + suffix;
      }
      const response = await axios.post(
        'https://api.atlassian.com/ex/jira/' +
          jiraProfile.resource.id +
          '/rest/api/3/project',
        bodyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );
      return response?.data;
    } catch (error) {
      const ae = error as AxiosError;
      if (isProjectKeyError(ae)) {
        randomSuffix = true;
      }
      if (isProjectNameError(ae)) {
        randomSuffixForName = true;
      }
      if (!isProjectKeyError(ae) && !isProjectNameError(ae)) {
        console.error(
          'server.jiraService.createJiraProject.error',
          (error as AxiosError).response?.data
        );
        throw error;
      }
      retryTimes += 1;
    }
  }
  throw Error('Failed to create Jira project after 3 retries.');
};

export async function saveJiraInfoForIssue(
  issueId: string,
  jira: JiraEntity
): Promise<any> {
  console.log('Saving Jira info for issue', issueId);
  const issue = await prisma.issue.findUnique({
    where: {
      id: issueId,
    },
  });

  let newMeta = (issue?.meta as Prisma.JsonObject) ?? {};
  newMeta.jira = jira;

  return await prisma.issue.update({
    where: {
      id: issueId,
    },
    data: {
      jiraId: `${jira.id}`,
      meta: newMeta,
    },
  });
}

export async function saveJiraLabelForMilestone(
  milestoneId: string,
  jiraLabelName: string
): Promise<any> {
  console.log(
    `Saving Jira label ${jiraLabelName} for milestone ${milestoneId}.`
  );
  const milestone = await prisma.workPlan.findUnique({
    where: {
      id: milestoneId,
    },
  });

  let newMeta = (milestone?.meta as Prisma.JsonObject) ?? {};
  newMeta.jira = jiraLabelName;

  return await prisma.workPlan.update({
    where: {
      id: milestoneId,
    },
    data: {
      meta: newMeta,
    },
  });
}

export async function readJiraInfoForIssue(
  issueId: string | null
): Promise<JiraEntity | null> {
  if (!issueId) {
    return null;
  }
  const issue = await prisma.issue.findUnique({
    where: {
      id: issueId,
    },
  });
  const meta = (issue?.meta as Prisma.JsonObject) ?? {};
  return meta?.jira as JiraEntity;
}

function convertToJiraType(type: string): string {
  if (type === 'TASK') {
    return 'Sub-task';
  }
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export const createJiraIssue = async function (
  willyIssue: Issue,
  willyUserUuid: string,
  jiraResourceId: string,
  jiraProjectKey: string,
  jiraLabels: string[],
  jiraCustomFields: Map<string, any>,
  willyUserJiraIdMap: Map<string, string | null>
) {
  let accessToken: string | null;
  let parentJiraInfo: JiraEntity | null;

  [accessToken, parentJiraInfo] = await Promise.all([
    getAccessToken(willyUserUuid),
    readJiraInfoForIssue(willyIssue.parentIssueId),
  ]);

  if (willyIssue.parentIssueId && !parentJiraInfo) {
    console.error(
      'server.jiraService.createJiraIssue.error :  No Jira data for parent issue = ',
      willyIssue.parentIssueId
    );
  }
  let jiraAssigneeId = null;
  if (willyIssue.ownerUserId) {
    jiraAssigneeId = willyUserJiraIdMap.get(willyIssue.ownerUserId);
  }
  let bodyData: any = {
    fields: {
      issuetype: {
        name: convertToJiraType(willyIssue.type),
      },
      project: {
        key: jiraProjectKey,
      },
      summary: willyIssue.name,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: willyIssue.description || '',
              },
            ],
          },
        ],
      },
    },
    update: {},
  };
  if (jiraAssigneeId) {
    bodyData.fields.assignee = { id: jiraAssigneeId };
  }

  if (parentJiraInfo?.key) {
    bodyData.fields.parent = {
      key: parentJiraInfo.key,
    };
  }
  if (jiraLabels) {
    bodyData.fields.labels = jiraLabels;
  }
  if (jiraCustomFields) {
    for (const [key, value] of jiraCustomFields) {
      bodyData.fields[key] = value;
    }
  }

  try {
    const response = await axios.post(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/api/3/issue',
      bodyData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    await saveJiraInfoForIssue(willyIssue.id, response.data);
  } catch (error) {
    console.error(
      'server.jiraService.createJiraIssue.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const getAllJiraUsers = async function (
  userUuid: string,
  jiraResourceId: string
): Promise<any[]> {
  const accessToken = await getAccessToken(userUuid);
  const response = await axios.get(
    'https://api.atlassian.com/ex/jira/' +
      jiraResourceId +
      '/rest/api/3/users/search',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );
  return response.data;
};

export const getScreens = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  startAt: number
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  try {
    return await axios.get(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/api/3/screens',
      {
        params: {
          startAt: startAt,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'server.jiraService.getAllScreens.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

export const getDefaultTabForScreen = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  screenId: number
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  try {
    const response = await axios.get(
      'https://api.atlassian.com/ex/jira/' +
        jiraResourceId +
        '/rest/api/3/screens/' +
        screenId +
        '/tabs',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    if (response.data.length === 0) {
      throw new Error('No tabs found for screen ' + screenId);
    }
    return response.data[0];
  } catch (error) {
    console.error(
      'server.jiraService.getTabsForScreen.error',
      (error as AxiosError).response?.data
    );
    throw error;
  }
};

function isAlreadyExistsError(error: AxiosError<any>): boolean {
  const { errors } = error.response?.data;
  return (
    error.response?.data?.status == '400' &&
    errors?.fieldId?.includes('already exists on the screen')
  );
}

export const addFieldToScreenTab = async function (
  willyUserUuid: string,
  jiraResourceId: string,
  screenId: number,
  tabId: number,
  fieldId: string
): Promise<any> {
  const accessToken = await getAccessToken(willyUserUuid);
  try {
    await axios.post(
      `https://api.atlassian.com/ex/jira/${jiraResourceId}/rest/api/3/screens/${screenId}/tabs/${tabId}/fields`,
      {
        fieldId: fieldId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const aeError = error as AxiosError;
    if (isAlreadyExistsError(aeError)) {
      return;
    }
    console.error('server.jiraService.getScreenTabsFields.error', aeError);
    throw error;
  }
};

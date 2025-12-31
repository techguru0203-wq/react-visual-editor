import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { JiraResource } from '../types/jiraTypes';
import { ProjectInfo } from '../types/projectTypes';

export async function fetchJiraRedirectUrl(): Promise<string> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/authorize/jira`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error fetching Jira Authorization URL: ' + errorMsg);
  }
}

export async function getJiraResource(): Promise<JiraResource[]> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/admin/jiraResource`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error fetching Jira resource: ' + errorMsg);
  }
}

export async function createJiraProject(
  projectInfo: ProjectInfo
): Promise<string> {
  const headers = await getHeaders();
  const body = {
    project: projectInfo,
  };
  const result = await fetch(`${api_url}/api/admin/createJiraProject`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error createJiraProject: ' + errorMsg);
  }
}

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { ProjectInfo } from '../types/projectTypes';

export async function getAllProjects(): Promise<ProjectInfo[]> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/all`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data as ProjectInfo[];
  } else {
    throw new Error('Error fetching Jira Authorization URL: ' + errorMsg);
  }
}

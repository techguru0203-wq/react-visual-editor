import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function getJiraUsers(enabled: boolean = true): Promise<any[]> {
  if (!enabled) {
    return [];
  }
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/admin/jiraUsers`, {
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

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { IssueChangeHistoryOutput, IssueOutput } from '../types/issueTypes';

export async function getIssueApi(
  issueShortName: string
): Promise<IssueOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/issues/${issueShortName}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading issues: ' + errorMsg);
  }
}

export async function getIssueChangeHistoryApi(
  issueId: string
): Promise<IssueChangeHistoryOutput[]> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/issues/${issueId}/history`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading issues: ' + errorMsg);
  }
}

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { CommentOutput } from '../types/commentTypes';

export async function getCommentsApi(
  issueId: string
): Promise<CommentOutput[]> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/issues/${issueId}/comments`, {
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

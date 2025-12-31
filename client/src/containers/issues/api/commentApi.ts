import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { CommentInput, CommentOutput } from '../types/commentTypes';

export async function addComment(
  comment: CommentInput
): Promise<CommentOutput> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/issues/${comment.issueId}/comments`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(comment),
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error adding issue suggestion: ' + errorMsg);
  }
  return data;
}

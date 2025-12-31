import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export interface FeedbackSubmission {
  npsScore: number;
  likes?: string;
  dislikes?: string;
}

export async function submitFeedbackApi(
  feedback: FeedbackSubmission
): Promise<{ success: boolean }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/feedback/submit`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(feedback),
  });

  const data = await result.json();
  if (data.success) {
    return data;
  }
  throw new Error(data.errorMsg || 'Failed to submit feedback');
}

export async function shouldShowFeedbackApi(): Promise<{
  shouldShow: boolean;
}> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/feedback/should-show`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const data = await result.json();
  return data;
}

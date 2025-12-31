import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { UserProfile } from '../../profile/types/profileTypes';

export async function cancelSubscriptionApi(): Promise<UserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/subscriptions/cancel`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Cancel user's subscription: ${errorMsg}`);
  }
}

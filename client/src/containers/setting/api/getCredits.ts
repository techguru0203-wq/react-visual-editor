import { CreditAction } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function getCreditsApi(): Promise<CreditAction[]> {
  let headers = await getHeaders();

  const result = await fetch(`${api_url}/api/credits`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

import { WorkPlan } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function updateWorkPlan(
  workPlan: Partial<WorkPlan>
): Promise<WorkPlan> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/workplans/update`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(workPlan),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error updating work plan: ' + errorMsg);
  }
  return data;
}

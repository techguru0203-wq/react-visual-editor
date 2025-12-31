import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { DevPlanOutput, UpdateDevPlanArgs } from "../types/devPlanTypes";

export async function updateDevPlanApi({ devPlanId, ...input }: UpdateDevPlanArgs): Promise<DevPlanOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/devPlan/${devPlanId}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error updating dev plan ' + errorMsg);
  }
}
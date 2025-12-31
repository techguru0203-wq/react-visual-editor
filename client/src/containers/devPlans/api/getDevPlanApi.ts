import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { DevPlanOutput } from "../types/devPlanTypes";

export async function getDevPlanApi(devPlanId: string): Promise<DevPlanOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/devPlan/${devPlanId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error loading document: ' + errorMsg);
  }
  return data;
}

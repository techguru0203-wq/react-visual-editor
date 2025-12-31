import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { TeamOutput } from "../types/teamTypes";

export async function getTeamApi(teamId: string): Promise<TeamOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/team/${teamId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

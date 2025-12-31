import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { TeamMember } from "../types/teamTypes";

export async function getTeamMembersApi(teamId: string): Promise<ReadonlyArray<TeamMember>> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/team/${teamId}/members`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading users in organization: ' + errorMsg);
  }
}

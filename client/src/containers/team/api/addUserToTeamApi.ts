import { UserTeam } from "@prisma/client";

import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { AddUserToTeamArgs } from "../types/teamTypes";

export async function addUserToTeamApi({ teamId, userId }: AddUserToTeamArgs): Promise<UserTeam> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/team/${teamId}/members/${userId}`, {
    method: 'PUT',
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

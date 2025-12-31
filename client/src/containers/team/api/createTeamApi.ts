import { Team } from "@prisma/client";

import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { CreateTeamArgs } from "../types/teamTypes";

export async function createTeamApi(input: CreateTeamArgs): Promise<Team> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/team`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

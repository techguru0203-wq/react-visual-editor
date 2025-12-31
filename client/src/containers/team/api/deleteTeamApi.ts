import { Team } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function deleteTeamApi(teamId: string): Promise<Team> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/team/${teamId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error deleting team: ' + errorMsg);
  }
}

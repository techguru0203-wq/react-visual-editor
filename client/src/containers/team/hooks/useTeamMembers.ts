import { useQuery } from "@tanstack/react-query";

import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getTeamMembersApi } from "../api/getTeamMembersApi";

export const TEAM_MEMBERS_API_KEY = 'TEAM_MEMBERS_API';

export function useTeamMembers(teamId: string) {
  return useQuery(
    [TEAM_MEMBERS_API_KEY, teamId],
    () => getTeamMembersApi(teamId),
    { staleTime: DEFAULT_QUERY_STALE_TIME },
  );
}

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getTeamApi } from "../api/getTeamApi";

export const GET_TEAM_API_QUERY_KEY = 'GET_TEAM_API';

export function useGetTeamApi(teamId: string) {
  return useQuery(
    [GET_TEAM_API_QUERY_KEY, teamId],
    () => getTeamApi(teamId),
    { staleTime: DEFAULT_QUERY_STALE_TIME },
  );
}

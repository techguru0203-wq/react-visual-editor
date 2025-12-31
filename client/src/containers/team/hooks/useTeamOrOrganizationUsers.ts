import { useQuery } from "@tanstack/react-query";

import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getOrganizationUsersApi } from "../../organization/api/getOrganizationUsersApi";
import { getTeamMembersApi } from "../api/getTeamMembersApi";
import { GetOrganizationOrTeamUsers } from "../types/teamTypes";

export const TEAM_OR_ORGANIZATION_MEMBERS_API_KEY = 'TEAM_OR_ORGANIZATION_MEMBERS_API';

export function useTeamOrOrganizationUsers(args: GetOrganizationOrTeamUsers) {
  return useQuery(
    [TEAM_OR_ORGANIZATION_MEMBERS_API_KEY, args],
    () => {
      if (args.source === 'team') {
        return args.teamId
          ? getTeamMembersApi(args.teamId).then(members => members.map(m => m.user))
          : getOrganizationUsersApi();
      } else {
        return getOrganizationUsersApi({ excludeTeamId: args.excludeTeamId });
      }
    },
    { staleTime: DEFAULT_QUERY_STALE_TIME },
  );
}

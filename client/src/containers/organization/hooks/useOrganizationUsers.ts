import { useQuery } from "@tanstack/react-query";

import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getOrganizationUsersApi } from "../api/getOrganizationUsersApi";
import { GetOrganizaionUsersArgs } from "../types/organizationTypes";

export const ORGANIZATION_USERS_QUERY_KEY = 'ORGANIZATION_USERS_QUERY';

export function useOrganizationUsers(args: GetOrganizaionUsersArgs = {}) {
  return useQuery(
    [ORGANIZATION_USERS_QUERY_KEY, args],
    () => getOrganizationUsersApi(args),
    { staleTime: DEFAULT_QUERY_STALE_TIME },
  );
}

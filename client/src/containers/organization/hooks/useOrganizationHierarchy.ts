import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "../../../common/contexts/currentUserContext";
import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getOrganizationHierarchyApi } from "../api/getOrganizationHierarchyApi";

export const ORGANIZATION_HIERARCHY_QUERY_KEY = 'ORGANIZAION_HIERARCHY_QUERY';

export function useOrganizationHierarchy() {
  const { hasProfile } = useCurrentUser();
  return useQuery(
    [ORGANIZATION_HIERARCHY_QUERY_KEY],
    getOrganizationHierarchyApi,
    { staleTime: DEFAULT_QUERY_STALE_TIME, enabled: hasProfile }
  );
}

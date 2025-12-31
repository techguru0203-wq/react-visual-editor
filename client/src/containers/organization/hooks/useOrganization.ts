import { Organization } from '@prisma/client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getOrganizationApi } from '../api/getOrganizationApi';
import { OrganizationWithContents } from '../types/organizationTypes';

export const ORGANIZATION_QUERY_KEY = 'ORGANIZATION_QUERY';
export const ORGANIZATION_WITH_CONTENTS_QUERY_KEY =
  'ORGANIZATION_WITH_CONTENTSQUERY';

export function useOrganization() {
  const { hasProfile } = useCurrentUser();
  return useQuery(
    [ORGANIZATION_QUERY_KEY],
    () => getOrganizationApi(false) as Promise<Organization>,
    { enabled: hasProfile, staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

export function useOrganizationWithContents(lightweight: boolean = false) {
  const { hasProfile } = useCurrentUser();
  const queryKey = lightweight
    ? [ORGANIZATION_WITH_CONTENTS_QUERY_KEY, 'lightweight']
    : [ORGANIZATION_WITH_CONTENTS_QUERY_KEY];

  return useQuery(
    queryKey,
    () =>
      getOrganizationApi(
        true,
        lightweight
      ) as Promise<OrganizationWithContents>,
    { enabled: hasProfile, staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

export function useOrganizationWithInfiniteProjects() {
  const { hasProfile } = useCurrentUser();

  return useInfiniteQuery(
    [ORGANIZATION_WITH_CONTENTS_QUERY_KEY, 'infinite'],
    ({ pageParam = 1 }) =>
      getOrganizationApi(
        true,
        true,
        pageParam,
        20
      ) as Promise<OrganizationWithContents>,
    {
      enabled: hasProfile,
      staleTime: DEFAULT_QUERY_STALE_TIME,
      getNextPageParam: (lastPage) => {
        if (lastPage.pagination?.hasMore) {
          return lastPage.pagination.page + 1;
        }
        return undefined;
      },
    }
  );
}

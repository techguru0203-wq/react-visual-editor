import { useQuery } from '@tanstack/react-query';

import {
  getProjectAccessApi,
  getProjectApi,
} from '../../containers/project/api/project';
import { DEFAULT_QUERY_STALE_TIME } from '../../lib/constants';

export const PROJECT_QUERY_KEY = 'PROJECT_QUERY_KEY';

export function useProjectQuery(projectId?: string | null) {
  return useQuery({
    queryKey: [PROJECT_QUERY_KEY, projectId],
    queryFn: async () => {
      // TODO - WHY is still firing?
      const data =
        projectId && projectId !== 'undefined'
          ? await getProjectApi(projectId)
          : null;
      return data;
    },
    enabled: !!projectId && projectId !== 'undefined', // Only fetch if projectId is defined and not "undefined"
    staleTime: DEFAULT_QUERY_STALE_TIME,
  });
}

export const PROJECT_ACCESS_QUERY_KEY = 'PROJECT_ACCESS_QUERY_KEY';

export function useProjectAccessQuery(projectId?: string | null) {
  // Normalize projectId - convert undefined/null/string "undefined" to null
  const normalizedProjectId =
    projectId &&
    projectId !== 'undefined' &&
    projectId !== 'null' &&
    typeof projectId === 'string'
      ? projectId
      : null;

  // Only create query if we have a valid projectId
  // Using a conditional query key that excludes undefined/null
  return useQuery({
    queryKey: normalizedProjectId
      ? [PROJECT_ACCESS_QUERY_KEY, normalizedProjectId]
      : [PROJECT_ACCESS_QUERY_KEY, 'disabled'],
    queryFn: async () => {
      // This should never execute when normalizedProjectId is null due to enabled check,
      // but adding safety check just in case
      if (!normalizedProjectId) {
        throw new Error('Project ID is required');
      }
      return await getProjectAccessApi(normalizedProjectId);
    },
    enabled: !!normalizedProjectId && typeof normalizedProjectId === 'string', // Only fetch if projectId is valid string
    staleTime: DEFAULT_QUERY_STALE_TIME,
    retry: false, // Don't retry if query fails
    refetchOnMount: false, // Don't refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}

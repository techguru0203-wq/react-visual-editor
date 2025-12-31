import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getAllProjects } from '../api/projectApi';

export const USE_PROJECTS_QUERY_KEY = 'USE_PROJECTS_QUERY';

export default function useProjectsQuery(isAuthenticated: boolean = true) {
  return useQuery([USE_PROJECTS_QUERY_KEY], getAllProjects, {
    staleTime: DEFAULT_QUERY_STALE_TIME,
    enabled: isAuthenticated,
  });
}

import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getProjectPermissionApi } from '../api/projectPermissionApi';

export const PROJECT_PERMISSION_QUERY_KEY = 'PROJECT_PERMISSION_QUERY_KEY';

export default function useProjectPermissionQuery(projectId: string) {
  return useQuery(
    [PROJECT_PERMISSION_QUERY_KEY, projectId],
    () => getProjectPermissionApi(projectId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

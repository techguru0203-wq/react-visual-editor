import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getMyIssuesApi } from '../api/getMyIssuesApi';
import { IssueOutput } from '../types/issueTypes';

export const GET_MY_ISSUES_QUERY_KEY = 'GET_MY_ISSUES_QUERY';

export function useMyIssues() {
  return useQuery(
    [GET_MY_ISSUES_QUERY_KEY],
    async () => {
      // Fetch first page with 50 issues (enough for most users, backend pagination makes it fast)
      const response = await getMyIssuesApi(1, 50);
      return response.data as ReadonlyArray<IssueOutput>;
    },
    { staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

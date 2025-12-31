import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getIssueApi, getIssueChangeHistoryApi } from '../api/getIssueApi';

export const GET_ISSUE_QUERY_KEY = 'GET_ISSUE_QUERY';
export const GET_ISSUE_CHANGE_HISTORY_QUERY_KEY =
  'GET_ISSUE_CHANGE_HISTORY_QUERY';

export function useIssue(issueShortName?: string) {
  return useQuery(
    [GET_ISSUE_QUERY_KEY, issueShortName],
    () => getIssueApi(issueShortName as string),
    { enabled: Boolean(issueShortName), staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

export function useIssueChangeHistory(shortName?: string) {
  return useQuery(
    [GET_ISSUE_CHANGE_HISTORY_QUERY_KEY, shortName],
    () => getIssueChangeHistoryApi(shortName as string),
    { enabled: Boolean(shortName), staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

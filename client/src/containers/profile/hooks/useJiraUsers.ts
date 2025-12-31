import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getJiraUsers } from '../api/jiraApi';

export const USE_JIRA_USERS_KEY = 'USE_JIRA_USERS';

export default function useJiraUsers(
  isJiraEnabled: boolean = true,
  isAuthenticated: boolean = true
) {
  return useQuery([USE_JIRA_USERS_KEY], () => getJiraUsers(isJiraEnabled), {
    staleTime: DEFAULT_QUERY_STALE_TIME,
    enabled: isAuthenticated,
  });
}

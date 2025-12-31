import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getCreditsApi } from '../api/getCredits';

export const GET_CREDITS_QUERY_KEY = 'GET_CREDITS_QUERY';

export function useCredits() {
  return useQuery([GET_CREDITS_QUERY_KEY], async () => getCreditsApi(), {
    staleTime: DEFAULT_QUERY_STALE_TIME,
  });
}

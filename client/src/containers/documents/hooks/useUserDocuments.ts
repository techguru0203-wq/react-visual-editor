import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getUserDocumentsApi } from '../api/getDocumentApi';

const GET_USER_DOCUMENTS_QUERY_KEY = 'GET_USER_DOCUMENTS_QUERY';

export function useUserDocuments(userId: string) {
  return useQuery(
    [GET_USER_DOCUMENTS_QUERY_KEY, userId],
    async () => getUserDocumentsApi(userId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

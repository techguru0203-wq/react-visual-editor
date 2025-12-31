import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getDocumentPermissionApi } from '../api/documentPermissionApi';

export const DOCUMENT_PERMISSION_QUERY_KEY = 'DOCUMENT_PERMISSION_QUERY_KEY';
export default function useDocumentPermissionQuery(documentId: string) {
  return useQuery(
    [DOCUMENT_PERMISSION_QUERY_KEY, documentId],
    () => getDocumentPermissionApi(documentId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

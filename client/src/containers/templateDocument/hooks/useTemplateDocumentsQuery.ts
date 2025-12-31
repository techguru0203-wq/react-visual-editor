import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getTemplateDocumentsApi } from '../api/templateDocumentsApi';

export const TEMPLATE_DOCUMENTS_QUERY_KEY = 'TEMPLATE_DOCUMENTS_QUERY_KEY';
export default function useTemplateDocumentsQuery(
  q: string,
  type: string,
  page: number = 1,
  limit: number = 20
) {
  return useQuery(
    [TEMPLATE_DOCUMENTS_QUERY_KEY, q, type, page, limit],
    () => getTemplateDocumentsApi(q, type, page, limit),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getTemplateDocumentByIdApi } from '../api/templateDocumentsApi';

export const TEMPLATE_DOCUMENTS_BY_ID_QUERY_KEY =
  'TEMPLATE_DOCUMENTS_BY_ID_QUERY_KEY';

export default function useTemplateDocumentByIdQuery(id: string) {
  return useQuery(
    [TEMPLATE_DOCUMENTS_BY_ID_QUERY_KEY, id],
    () => getTemplateDocumentByIdApi(id),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

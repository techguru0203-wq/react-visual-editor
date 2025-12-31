import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getOrganizationTemplateDocumentsApi } from '../api/getOrganizationTemplateDocuments';

export const ORG_TEMPLATE_DOCUMENTS_QUERY_KEY =
  'ORG_TEMPLATE_DOCUMENTS_QUERY_KEY';
export default function useOrgTemplateDocumentsQuery(
  q: string,
  type: string = '',
  page: number = 1,
  limit: number = 20
) {
  return useQuery(
    [ORG_TEMPLATE_DOCUMENTS_QUERY_KEY, q, type, page, limit],
    () => getOrganizationTemplateDocumentsApi(q, type, page, limit),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME * 10,
    }
  );
}

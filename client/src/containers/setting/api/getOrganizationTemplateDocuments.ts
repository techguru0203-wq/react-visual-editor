import { PaginationInfo } from '../../../../../shared/types';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { TemplateDocumentItemType } from '../../templateDocument/types/templateDocumentTypes';

export async function getOrganizationTemplateDocumentsApi(
  q: string = '',
  type: string = '',
  page: number = 1,
  limit: number = 20
): Promise<{
  list: ReadonlyArray<TemplateDocumentItemType>;
  pagination: PaginationInfo;
}> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/organization/template-documents?q=${q}&type=${type}&page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

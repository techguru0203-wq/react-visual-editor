import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import {
  getDocumentApi,
  getDocumentChatHistoryApi,
} from '../api/getDocumentApi';

export const GET_DOCUMENT_QUERY_KEY = 'GET_DOCUMENT_QUERY';
export const GET_DOCUMENT_ChatHISTORY_QUERY_KEY =
  'GET_DOCUMENT_ChatHISTORY_QUERY_KEY';

export function useDocument(documentId: string) {
  return useQuery(
    [GET_DOCUMENT_QUERY_KEY, documentId],
    async () => getDocumentApi(documentId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

export function useDocumentChatHistory(documentId: string) {
  return useQuery(
    [GET_DOCUMENT_ChatHISTORY_QUERY_KEY, documentId],
    async () => getDocumentChatHistoryApi(documentId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

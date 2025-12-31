import { DocumentPermissionTypes } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { DocumentOutput, TemplateDocumentOutput } from '../types/documentTypes';

export async function getDocumentApi(
  documentId: string,
  email: string = ''
): Promise<
  DocumentOutput & { defaultTemplate: TemplateDocumentOutput | null }
> {
  let headers = await getHeaders();

  const result = await fetch(`${api_url}/api/documents/${documentId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function getSharedDocumentApi(
  documentId: string,
  email: string | null
): Promise<
  DocumentOutput & {
    currentUserId: string | null;
    documentPermission: DocumentPermissionTypes;
  }
> {
  let headers = {};
  try {
    headers = await getHeaders();
  } catch (e) {}

  const result = await fetch(
    `${api_url}/api/documents/shared/${documentId}?accessEmail=${email}`,
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

export async function getUserDocumentsApi(
  userId: string
): Promise<DocumentOutput[]> {
  let headers = await getHeaders();

  const result = await fetch(`${api_url}/api/documents`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function getDocumentChatHistoryApi(documentId: string) {
  let headers = await getHeaders();

  const result = await fetch(`${api_url}/api/chats?docId=${documentId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

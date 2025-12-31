import { Access, DocumentPermission } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { UserProfile } from '../../profile/types/profileTypes';

type AddDocumentPermissionInput = {
  documentId: string;
  emails: string[];
  permission: string;
  documentPermissions: DocumentPermission[];
  documentAccess: Access;
  shareUrl: string;
};

export async function getDocumentPermissionApi(
  documentId: string
): Promise<DocumentPermission[]> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/documents/${documentId}/permission`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error  document permission: ' + errorMsg);
  }
}

export async function addDocumentPermissionApi(
  input: AddDocumentPermissionInput
): Promise<UserProfile[]> {
  const headers = await getHeaders();
  const body = {
    emails: input.emails,
    permission: input.permission,
    documentPermissions: input.documentPermissions || [],
    documentAccess: input.documentAccess,
    shareUrl: input.shareUrl,
  };
  const result = await fetch(
    `${api_url}/api/documents/${input.documentId}/permission`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error add document permission: ' + errorMsg);
  }
}

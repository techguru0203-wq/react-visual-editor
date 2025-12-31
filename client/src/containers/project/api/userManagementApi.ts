import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import type {
  CreateUserRequest,
  CreateUserResponse,
  UsersListResponse,
} from '../../../../../shared/types/userManagement';

export async function listUsers(
  documentId: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<UsersListResponse> {
  const headers = await getHeaders();
  const res = await fetch(
    `${api_url}/api/database/${documentId}/users?environment=${environment}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  return res.json();
}

export async function createUser(
  documentId: string,
  payload: CreateUserRequest,
  environment: 'preview' | 'production' = 'preview'
): Promise<CreateUserResponse> {
  const headers = await getHeaders();
  const res = await fetch(
    `${api_url}/api/database/${documentId}/users?environment=${environment}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    }
  );
  return res.json();
}

export async function updateUser(
  documentId: string,
  userId: string,
  payload: Partial<CreateUserRequest> & { name?: string; email?: string },
  environment: 'preview' | 'production' = 'preview'
): Promise<CreateUserResponse> {
  const headers = await getHeaders();
  const res = await fetch(
    `${api_url}/api/database/${documentId}/users/${userId}?environment=${environment}`,
    {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    }
  );
  return res.json();
}

export async function deleteUser(
  documentId: string,
  userId: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<{ success: boolean; data: { id: string } }> {
  const headers = await getHeaders();
  const res = await fetch(
    `${api_url}/api/database/${documentId}/users/${userId}?environment=${environment}`,
    {
      method: 'DELETE',
      headers,
      credentials: 'include',
    }
  );
  return res.json();
}

import { Access, ProjectPermission } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { UserProfile } from '../../profile/types/profileTypes';

type AddProjectPermissionInput = {
  projectId: string;
  emails: string[];
  permission: string;
  projectPermissions: ProjectPermission[];
  projectAccess: Access;
  shareUrl: string;
};

export async function getProjectPermissionApi(
  projectId: string
): Promise<ProjectPermission[]> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/projects/${projectId}/permission`,
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
    throw new Error('Error project permission: ' + errorMsg);
  }
}

export async function addProjectPermissionApi(
  input: AddProjectPermissionInput
): Promise<UserProfile[]> {
  const headers = await getHeaders();
  const body = {
    emails: input.emails,
    permission: input.permission,
    projectPermissions: input.projectPermissions || [],
    projectAccess: input.projectAccess,
    shareUrl: input.shareUrl,
  };
  const result = await fetch(
    `${api_url}/api/projects/${input.projectId}/permission`,
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
    throw new Error('Error add project permission: ' + errorMsg);
  }
}

import { User } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { GetOrganizaionUsersArgs } from '../types/organizationTypes';
import { noop } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { updateOrganization } from './getOrganizationApi';

export async function getOrganizationUsersApi(
  args: GetOrganizaionUsersArgs = {}
): Promise<ReadonlyArray<User>> {
  const headers = await getHeaders();

  const queryParams = [];
  if (args.excludeTeamId) {
    queryParams.push(`excludeTeamId=${args.excludeTeamId}`);
  }

  const result = await fetch(
    `${api_url}/api/organization/users?${queryParams.join('&')}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data.sort((a: User, b: User) =>
      (a.firstname + a.lastname).localeCompare(b.firstname + b.lastname)
    );
  } else {
    throw new Error('Error loading users in organization: ' + errorMsg);
  }
}

export function useUpdateOrganizationMutation({
  onError = noop,
  onSuccess = noop,
}: {
  onError?: () => void;
  onSuccess: (data: any) => void;
}) {
  return useMutation(updateOrganization, {
    onSuccess: (data) => {
      onSuccess(data);
    },
    onError,
  });
}

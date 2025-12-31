import { User } from '@prisma/client';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'lodash';

import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { ORGANIZATION_USERS_QUERY_KEY } from '../../organization/hooks/useOrganizationUsers';
import {
  confirmUserInvitationApi,
  createNewVirtualUserApi,
} from '../api/createNewUserApi';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (data: Partial<User>) => void;
}

export default function useUserMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [ORGANIZATION_USERS_QUERY_KEY],
  });
  return {
    createVirtualUserMutation: useMutation(createNewVirtualUserApi, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),
    confirmUserInvitationMutation: useMutation(confirmUserInvitationApi, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),
  };
}

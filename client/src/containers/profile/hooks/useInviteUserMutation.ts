import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATION_WITH_CONTENTS_QUERY_KEY } from '../../organization/hooks/useOrganization';
import { GET_TEAM_API_QUERY_KEY } from '../../team/hooks/useGetTeamApi';
import { inviteUserApi } from '../api/profileApi';
import { InviteUserResponse } from '../types/profileTypes';

type MutationArgs = {
  onSuccess: (result: InviteUserResponse) => void;
  onError: (error: Error | string) => void;
};

export function useInviteUserMutation(
  teamId: string | undefined,
  { onSuccess, onError }: MutationArgs
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteUserApi,
    onSuccess: (result: InviteUserResponse) => {
      console.info('Invalidate team query for', teamId);
      queryClient.invalidateQueries([GET_TEAM_API_QUERY_KEY, teamId]);
      queryClient.invalidateQueries([ORGANIZATION_WITH_CONTENTS_QUERY_KEY]);
      onSuccess(result);
    },
    onError: (error) => {
      console.error('UpdateProfileMutation error', error);
      onError(error as string | Error);
    },
  });
}

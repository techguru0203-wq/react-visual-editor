import { Team } from '@prisma/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { noop } from 'lodash';

import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { ORGANIZATION_HIERARCHY_QUERY_KEY } from '../../organization/hooks/useOrganizationHierarchy';
import { createTeamApi } from '../api/createTeamApi';
import { deleteTeamApi } from '../api/deleteTeamApi';
import { updateTeamApi } from '../api/updateTeamApi';
import { GET_TEAM_API_QUERY_KEY } from './useGetTeamApi';

type MutationArgs = {
  onSuccess: (result: Team) => void;
  onError: (error: Error | string) => void;
};

export function useCreateTeamMutation({ onSuccess, onError }: MutationArgs) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTeamApi,
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [ORGANIZATION_HIERARCHY_QUERY_KEY],
      });
      onSuccess(result);
    },
    onError: (error) => {
      console.error('createTeamMutation error', error);
      onError(error as string | Error);
    },
  });
}

export function useUpdateTeamMutation({
  onError = noop,
  onSuccess = noop,
}: MutationArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [GET_TEAM_API_QUERY_KEY],
  });

  return {
    updateTeamMutation: useMutation(updateTeamApi, {
      onSuccess: (team) => {
        onSuccess(team);
        refreshQueries();
      },
      onError,
    }),
  };
}

export function useDeleteTeamMutation({
  onError = noop,
  onSuccess = noop,
}: MutationArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [GET_TEAM_API_QUERY_KEY],
  });

  return {
    deleteTeamMutation: useMutation(deleteTeamApi, {
      onSuccess: (team) => {
        onSuccess(team);
        refreshQueries();
      },
      onError,
    }),
  };
}

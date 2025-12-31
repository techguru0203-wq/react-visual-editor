import { useMutation, useQueryClient } from '@tanstack/react-query';

import { UserProfile } from '../../profile/types/profileTypes';
import { addProjectPermissionApi } from '../api/projectPermissionApi';
import { PROJECT_PERMISSION_QUERY_KEY } from './useProjectPermissionQuery';

type MutationArgs = {
  projectId: string;
  onSuccess: (data: UserProfile[]) => void;
  onError: (error: Error | string) => void;
};

export function useAddProjectPermissionMutation({
  projectId,
  onSuccess,
  onError,
}: MutationArgs) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectPermissionApi,
    onSuccess: (data) => {
      console.log('useAddProjectPermissionMutation success');
      onSuccess(data);
      queryClient.invalidateQueries([PROJECT_PERMISSION_QUERY_KEY, projectId]);
    },
    onError: (error) => {
      console.log('useAddProjectPermissionMutation error', error);
      onError(error as string | Error);
    },
  });
}

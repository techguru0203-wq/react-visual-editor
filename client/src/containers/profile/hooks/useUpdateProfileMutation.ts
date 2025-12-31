import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateUserProfile } from '../api/profileApi';
import { UserProfile } from '../types/profileTypes';

type MutationArgs = {
  onSuccess: (profile: UserProfile) => void;
  onError: (error: Error | string) => void;
};

export function useUpdateProfileMutation({ onSuccess, onError }: MutationArgs) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      console.log('UpdateProfileMutation success', data);
      onSuccess(data);
      // This pretty much invalidates all of our data. This shouldn't happen frequently
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.log('UpdateProfileMutation error', error);
      onError(error as string | Error);
    },
  });
}

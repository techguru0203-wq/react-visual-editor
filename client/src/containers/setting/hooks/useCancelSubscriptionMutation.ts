import { useMutation, useQueryClient } from '@tanstack/react-query';

import { USER_PROFILE_QUERY_KEY } from '../../profile/hooks/useUserProfileQuery';
import { UserProfile } from '../../profile/types/profileTypes';
import { cancelSubscriptionApi } from '../api/subscription';

type MutationArgs = {
  onSuccess: (result: UserProfile) => void;
  onError: (error: Error | string) => void;
};

export function useCancelSubscriptionMutation({
  onSuccess,
  onError,
}: MutationArgs) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscriptionApi,
    onSuccess(data) {
      onSuccess(data);
      queryClient.invalidateQueries({ queryKey: [USER_PROFILE_QUERY_KEY] });
    },
    onError(error) {
      console.log('CancelSubscriptionMutation error', error);
      onError(error as string | Error);
    },
  });
}

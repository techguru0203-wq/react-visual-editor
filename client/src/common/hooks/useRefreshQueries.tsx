import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface HookArgs {
  queryKey: Array<string>;
}

export function useRefreshQueries({ queryKey }: HookArgs) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    console.log('in useRefreshQueries.refresh:', queryKey);
    queryClient.invalidateQueries({
      queryKey: queryKey,
    });
    queryClient.refetchQueries();
  }, [queryClient, queryKey]);
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries();
    queryClient.refetchQueries();
  }, [queryClient]);
}

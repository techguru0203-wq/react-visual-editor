import { useMutation } from '@tanstack/react-query';
import { noop } from 'lodash';

import { PROJECT_QUERY_KEY } from '../../../common/hooks/useProjectsQuery';
import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { updateWorkPlan } from '../api/workPlan';
import { WorkPlan } from '.prisma/client';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (data: WorkPlan) => void;
}

export default function useWorkPlanMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  // TODO - Update freshquery to only refresh the project that was updated
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });

  return {
    updateWorkPlanMutation: useMutation(updateWorkPlan, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),
  };
}

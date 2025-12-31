import { DocumentStatus } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PROJECT_QUERY_KEY } from "../../../common/hooks/useProjectsQuery";
import { updateDevPlanApi } from "../api/updateDevPlanApi";
import { DevPlanOutput } from "../types/devPlanTypes";
import { GET_DEV_PLAN_QUERY_KEY } from "./useDevPlan";

type MutationHooks = Readonly<{
  onSuccess: (output: DevPlanOutput) => void;
  onError?: (error: unknown) => void;
}>;

export function useUpdateDevPlanMutation(args: MutationHooks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateDevPlanApi,
    onSuccess: output => {
      queryClient.invalidateQueries([GET_DEV_PLAN_QUERY_KEY, output.id]);
      if (output.status === DocumentStatus.PUBLISHED) {
        // If we re-published the project, also invalidate the project query as well
        queryClient.invalidateQueries([PROJECT_QUERY_KEY, output.projectId]);
      }
      args.onSuccess(output);
    },
    onError: error => {
      console.error('Error occurred in updateDevPlanMutation', error);
      if (args.onError) {
        args.onError(error);
      } else {
        throw error;
      }
    }
  })
}
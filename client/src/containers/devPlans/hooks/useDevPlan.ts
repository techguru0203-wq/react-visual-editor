import { useQuery } from "@tanstack/react-query";

import { DEFAULT_QUERY_STALE_TIME } from "../../../lib/constants";
import { getDevPlanApi } from "../api/getDevPlanApi";

export const GET_DEV_PLAN_QUERY_KEY = 'GET_DEV_PLAN_QUERY_KEY';

export function useDevPlan(devPlanId: string) {
  return useQuery(
    [GET_DEV_PLAN_QUERY_KEY, devPlanId],
    async () => getDevPlanApi(devPlanId as string),
    { staleTime: DEFAULT_QUERY_STALE_TIME },
  );
}
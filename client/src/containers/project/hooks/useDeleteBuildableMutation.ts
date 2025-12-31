import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PROJECT_QUERY_KEY } from "../../../common/hooks/useProjectsQuery";
import { GET_ISSUE_QUERY_KEY } from "../../issues/hooks/useIssue";
import { GET_MY_ISSUES_QUERY_KEY } from "../../issues/hooks/useMyIssues";
import { ORGANIZATION_WITH_CONTENTS_QUERY_KEY } from "../../organization/hooks/useOrganization";
import { GET_TEAM_API_QUERY_KEY } from "../../team/hooks/useGetTeamApi";
import { deleteBuildableApi } from "../api/deleteBuildableApi";
import { DeleteBuildableArgs } from "../types/projectType";

type MutationArguments = Readonly<{
  onError: (error: string) => void;
  onSuccess: () => void;
}>;


export function useDeleteBuildableMutation({ onSuccess, onError }: MutationArguments) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBuildableApi,
    onError,
    onSuccess: ({ projectId, buildableIssueId }: DeleteBuildableArgs) => {
      console.log('deleteBuildableApi succeeded');
      queryClient.invalidateQueries([GET_ISSUE_QUERY_KEY, buildableIssueId])
      queryClient.invalidateQueries([GET_MY_ISSUES_QUERY_KEY]);
      queryClient.invalidateQueries([GET_TEAM_API_QUERY_KEY]);
      queryClient.invalidateQueries([ORGANIZATION_WITH_CONTENTS_QUERY_KEY]);
      queryClient.invalidateQueries([PROJECT_QUERY_KEY, projectId])
      onSuccess();
    }
  })
}
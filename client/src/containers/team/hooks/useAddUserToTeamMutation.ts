import { UserTeam } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ORGANIZATION_USERS_QUERY_KEY } from "../../organization/hooks/useOrganizationUsers";
import { addUserToTeamApi } from "../api/addUserToTeamApi";
import { GET_TEAM_API_QUERY_KEY } from "./useGetTeamApi";

type MutationArgs = {
  onSuccess: (result: UserTeam) => void,
  onError: (error: Error | string) => void,
}

export function useAddUserToTeamMutation({ onSuccess, onError }: MutationArgs) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserToTeamApi,
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: [ORGANIZATION_USERS_QUERY_KEY, result.teamId] });
      queryClient.invalidateQueries({ queryKey: [GET_TEAM_API_QUERY_KEY, result.teamId]});
      onSuccess(result);
    },
    onError: error => {
      console.error('UpdateProfileMutation error', error);
      onError(error as string | Error);
    }
  });
}
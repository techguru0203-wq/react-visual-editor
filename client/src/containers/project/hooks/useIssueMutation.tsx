import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PROJECT_QUERY_KEY } from '../../../common/hooks/useProjectsQuery';
import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { GET_ISSUE_QUERY_KEY } from '../../issues/hooks/useIssue';
import { IssueSuggestionOutput } from '../../issues/types/issueTypes';
import {
  addIssue,
  addIssuePublish,
  addIssueSuggestion,
  updateIssue,
} from '../api/issue';
import { Issue, Project } from '.prisma/client';

interface HookArgs<T> {
  onError?: (err: string) => void;
  onSuccess: (data: T) => void;
}

export function useUpdateIssueMutation({
  onSuccess,
  onError,
}: HookArgs<Issue>) {
  const queryClient = useQueryClient();
  return useMutation(updateIssue, {
    onSuccess: (data) => {
      onSuccess(data);
      queryClient.invalidateQueries([PROJECT_QUERY_KEY, data.projectId]);
      queryClient.invalidateQueries([GET_ISSUE_QUERY_KEY, data.shortName]);
    },
    onError,
  });
}

export function useAddIssueSuggestionMutation({
  onSuccess,
  onError,
}: HookArgs<IssueSuggestionOutput>) {
  const queryClient = useQueryClient();
  return useMutation(addIssueSuggestion, {
    onSuccess: (data) => {
      onSuccess(data);
      queryClient.invalidateQueries([PROJECT_QUERY_KEY]);
    },
    onError,
  });
}

export function useAddIssuePublishMutation({
  onSuccess,
  onError,
}: HookArgs<Project>) {
  const queryClient = useQueryClient();
  return useMutation(addIssuePublish, {
    onSuccess: (data) => {
      onSuccess(data);
      queryClient.invalidateQueries([PROJECT_QUERY_KEY, data.id]);
    },
    onError,
  });
}

export function useAddIssueMutation({ onSuccess, onError }: HookArgs<Project>) {
  const queryClient = useQueryClient();
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });

  return useMutation(addIssue, {
    onSuccess: (data) => {
      onSuccess(data);
      queryClient.invalidateQueries([GET_ISSUE_QUERY_KEY, data.id]);
      refreshQueries();
    },
    onError,
  });
}

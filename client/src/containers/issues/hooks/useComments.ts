import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { addComment } from '../api/commentApi';
import { getCommentsApi } from '../api/getCommentApi';
import { CommentOutput } from '../types/commentTypes';

export const GET_COMMENTS_QUERY_KEY = 'GET_COMMENTS_QUERY';

export function useComments(issueId?: string) {
  return useQuery(
    [GET_COMMENTS_QUERY_KEY, issueId],
    () => getCommentsApi(issueId as string),
    { enabled: Boolean(issueId), staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

interface HookArgs<T> {
  onError?: (err: string) => void;
  onSuccess: (data: T) => void;
}

export function useAddIssueCommentMutation(
  issueShortName: string,
  { onSuccess, onError }: HookArgs<CommentOutput>
) {
  const queryClient = useQueryClient();
  return useMutation(addComment, {
    onSuccess: (data) => {
      onSuccess(data);
      queryClient.invalidateQueries([GET_COMMENTS_QUERY_KEY, issueShortName]);
    },
    onError,
  });
}

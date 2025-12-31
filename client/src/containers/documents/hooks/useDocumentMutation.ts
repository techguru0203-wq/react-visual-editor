import { useMutation, useQueryClient } from '@tanstack/react-query';
import { noop } from 'lodash';

import { PROJECT_QUERY_KEY } from '../../../common/hooks/useProjectsQuery';
import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { upsertDocument } from '../../project/api/document';
import { LegacyDocumentOutput } from '../../project/types/projectType';
import { GET_DOCUMENT_QUERY_KEY } from './useDocument';

const DOCUMENT_QUERY_KEY = 'DOCUMENT_QUERY_KEY';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (document: LegacyDocumentOutput) => void;
}

export function useDocumentMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [DOCUMENT_QUERY_KEY],
  });

  return {
    createDocumentMutation: useMutation(upsertDocument, {
      onSuccess: (document: LegacyDocumentOutput) => {
        onSuccess(document);
        refreshQueries();
      },
      onError,
    }),
  };
}

export function useUpdateDocumentMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const queryClient = useQueryClient();

  return {
    updateDocumentMutation: useMutation(upsertDocument, {
      onSuccess: (document) => {
        onSuccess(document);
        // Invalidate the specific document query to refresh the client-side state
        queryClient.invalidateQueries([GET_DOCUMENT_QUERY_KEY, document.id]);
        // Also invalidate the project query to update ProjectStep status
        if (document.projectId) {
          queryClient.invalidateQueries([
            PROJECT_QUERY_KEY,
            document.projectId,
          ]);
        }
      },
      onError,
    }),
  };
}

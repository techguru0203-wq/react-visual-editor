import { DOCTYPE } from '@prisma/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { noop } from 'lodash';

import { PROJECT_QUERY_KEY } from '../../../common/hooks/useProjectsQuery';
import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { GET_DEV_PLAN_QUERY_KEY } from '../../devPlans/hooks/useDevPlan';
import { GET_DOCUMENT_QUERY_KEY } from '../../documents/hooks/useDocument';
import {
  generateDocument,
  generateRefinement,
  requestDocumentAccess,
  resetDocument,
  upsertDocument,
} from '../api/document';
import {
  LegacyDocumentOutput,
  RefinementGenerationOutput,
} from '../types/projectType';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (doc: LegacyDocumentOutput) => void;
}

interface HookArgsRefinement {
  onError?: (err: string) => void;
  onSuccess?: (doc: RefinementGenerationOutput) => void;
}

export default function useDocumentMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  // TODO - Update freshquery to only refresh the document that was updated
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });
  const queryClient = useQueryClient();

  return {
    upsertDocumentMutation: useMutation(upsertDocument, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),

    generateDocumentMutation: useMutation(generateDocument, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
        if (data?.type === DOCTYPE.DEVELOPMENT_PLAN) {
          queryClient.invalidateQueries([GET_DEV_PLAN_QUERY_KEY, data.id]);
        }
      },
      onError,
    }),

    requestDocumentAccessMutation: useMutation(requestDocumentAccess, {
      onSuccess: (data) => {
        onSuccess(data);
      },
      onError,
    }),

    resetDocumentMutation: useMutation(resetDocument, {
      onSuccess: (data) => {
        onSuccess(data);
        // Use direct invalidation instead of refreshQueries to avoid triggering other queries
        queryClient.invalidateQueries({
          queryKey: [GET_DOCUMENT_QUERY_KEY],
        });
      },
      onError,
    }),
  };
}

export function useRefinementDocumentMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgsRefinement) {
  // const refreshQueries = useRefreshQueries({
  //   queryKey: [PROJECT_QUERY_KEY],
  // });

  return {
    generateRefinementDocumentMutation: useMutation(generateRefinement, {
      onSuccess: (data) => {
        onSuccess(data);
        // refreshQueries();
      },
      onError,
    }),
  };
}

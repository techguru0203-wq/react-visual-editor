import { TemplateDocument } from '@prisma/client';
import { useMutation } from '@tanstack/react-query';

import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { ORG_TEMPLATE_DOCUMENTS_QUERY_KEY } from '../../setting/hooks/useOrgTemplateDocumentsQuery';
import {
  addTemplateDocumentsApi,
  createNewTemplateApi,
  createTemplateCloneApi,
  createTemplatePromptApi,
  createTemplateSampleOutputApi,
} from '../api/templateDocumentsApi';

type MutationArgs = {
  onSuccess: (
    result: Partial<TemplateDocument> & {
      chatSessionId?: string;
      docId?: string;
    }
  ) => void;
  onError: (error: Error | string) => void;
};

export function useTemplateDocumentMutation({
  onSuccess,
  onError,
}: MutationArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [ORG_TEMPLATE_DOCUMENTS_QUERY_KEY],
  });

  return {
    addTemplateDocumentMutation: useMutation(addTemplateDocumentsApi, {
      onSuccess: (result) => {
        onSuccess(result);
        refreshQueries();
      },
      onError,
    }),

    createTemplatePromptMutation: useMutation(createTemplatePromptApi, {
      onSuccess: (data) => {
        onSuccess(data);
      },
      onError,
    }),

    createTemplateSampleOutputMutation: useMutation(
      createTemplateSampleOutputApi,
      {
        onSuccess: (data) => {
          onSuccess(data);
        },
        onError,
      }
    ),
    createNewTemplateMutation: useMutation(createNewTemplateApi, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),
    createTemplateCloneMutation: useMutation(createTemplateCloneApi, {
      onSuccess: (data) => {
        onSuccess(data);
      },
      onError,
    }),
  };
}

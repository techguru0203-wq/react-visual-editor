import { useMutation } from '@tanstack/react-query';
import { noop } from 'lodash';

import { ProjectOutput } from '../../../../../shared/types';
import { PROJECT_QUERY_KEY } from '../../../common/hooks/useProjectsQuery';
import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import {
  createProjectApi,
  deleteProjectApi,
  updateProjectApi,
} from '../api/project';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (project: ProjectOutput) => void;
}

export function useAddProjectMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });

  return {
    createProjectMutation: useMutation(createProjectApi, {
      onSuccess: (project) => {
        onSuccess(project);
        refreshQueries();
      },
      onError,
    }),
  };
}

export function useUpdateProjectMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });

  return {
    updateProjectMutation: useMutation(updateProjectApi, {
      onSuccess: (project) => {
        onSuccess(project);
        refreshQueries();
      },
      onError,
    }),
  };
}

export function useDeleteProjectMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [PROJECT_QUERY_KEY],
  });

  return {
    deleteProjectMutation: useMutation(deleteProjectApi, {
      onSuccess: (project) => {
        onSuccess(project);
        refreshQueries();
      },
      onError,
    }),
  };
}

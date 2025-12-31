import { Specialty } from '@prisma/client';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'lodash';

import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { upsertSpecialtyApi } from '../api/specialtiesApi';
import { SPECIALTIES_QUERY_KEY } from './useSpecialties';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (data: Partial<Specialty>) => void;
}

export default function useSpecialtyMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [SPECIALTIES_QUERY_KEY],
  });
  return {
    upsertSpecialtyMutation: useMutation(upsertSpecialtyApi, {
      onSuccess: (data) => {
        onSuccess(data);
        refreshQueries();
      },
      onError,
    }),
  };
}

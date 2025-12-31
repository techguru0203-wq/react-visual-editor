import { Specialty } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getSpecialtiesApi } from '../api/specialtiesApi';

export const SPECIALTIES_QUERY_KEY = 'USE_SPECIALTIES_QUERY';

export function useSpecialties() {
  return useQuery(
    [SPECIALTIES_QUERY_KEY],
    () => getSpecialtiesApi() as Promise<Specialty[]>,
    { staleTime: DEFAULT_QUERY_STALE_TIME }
  );
}

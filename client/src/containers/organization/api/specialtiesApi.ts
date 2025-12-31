import { Specialty } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function getSpecialtiesApi(): Promise<Partial<Specialty>[]> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/specialties`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading specialties: ' + errorMsg);
  }
}

export async function upsertSpecialtyApi(
  specialty: Partial<Specialty>
): Promise<Partial<Specialty>> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/specialties`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(specialty),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(`Error updating project (${specialty}): ${errorMsg}`);
  }
  return data;
}

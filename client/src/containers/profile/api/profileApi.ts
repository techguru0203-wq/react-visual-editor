import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import {
  InviteUserInput,
  InviteUserResponse,
  UserProfile,
  UserProfileInput,
} from '../types/profileTypes';

export async function fetchUserProfile(id: string): Promise<UserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/user/profile/${id}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading user profile: ' + errorMsg);
  }
}

export async function updateUserProfile(
  input: Partial<UserProfileInput>
): Promise<UserProfile> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/user/profile`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body:
      input.velocity !== undefined
        ? JSON.stringify({
            ...input,
            velocity: Number(input.velocity),
            sampleTaskStoryPoint: Number(input.sampleTaskStoryPoint),
          })
        : JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error updating user profile: ' + errorMsg);
  }
}

export async function inviteUserApi(
  input: InviteUserInput
): Promise<InviteUserResponse> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/user/invite`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error updating user profile: ' + errorMsg);
  }
}

export async function getCompanyInfo(website: string): Promise<any> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/user/companyInfo`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ website }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error get company info: ' + errorMsg);
  }
}

import { UserOutput } from '../../../../../shared/types';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

type CreateNewUserInput = {
  newUserId?: string;
  email: string;
  organizationName?: string;
  organizationWebsite?: string;
  organizationId?: string;
  firstname?: string;
  lastname?: string;
  specialty?: string;
  velocity?: number;
  role?: string;
  referralCode?: string; // Add referral code support
};

export async function createNewUserApi(
  input: CreateNewUserInput
): Promise<UserOutput> {
  const result = await fetch(`${api_url}/api/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error signing up new user: ' + errorMsg);
  }
}

export async function createNewVirtualUserApi(
  input: CreateNewUserInput
): Promise<UserOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/user/virtual`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error creating new virtual user: ' + errorMsg);
  }
}

export async function confirmUserInvitationApi(input: {
  inviterEmail: string;
}): Promise<UserOutput> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/user/confirmInvitation`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg);
  }
}

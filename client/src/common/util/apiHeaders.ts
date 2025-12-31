import { fetchAuthSession } from 'aws-amplify/auth';

export async function getHeaders(): Promise<Record<string, string>> {
  const { tokens } = await fetchAuthSession();
  if (!tokens) {
    throw new Error('No access token is available');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens.accessToken.toString()}`,
  };
}

export async function getFormHeaders(): Promise<Record<string, string>> {
  const { tokens } = await fetchAuthSession();
  if (!tokens) {
    throw new Error('No access token is available');
  }
  return {
    Authorization: `Bearer ${tokens.accessToken.toString()}`,
  };
}

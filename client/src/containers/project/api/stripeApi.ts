import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export interface SaveStripeAndWebhookParams {
  deployDocId: string;
  userDomain: string;
}

export interface SetupWebhookResult {
  success: boolean;
  endpointId?: string;
  signingSecret?: string | null;
  message?: string;
}

export async function setupStripeWebhookOnServer(params: {
  secretKey: string;
  userDomain: string;
}): Promise<SetupWebhookResult> {
  const headers = await getHeaders();
  const res = await fetch(`${api_url}/api/stripe/setup-webhook`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`setup-webhook failed: ${res.status} ${text}`);
  }
  return (await res.json()) as SetupWebhookResult;
}

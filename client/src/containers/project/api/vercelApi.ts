import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

interface VercelEnvVar {
  key: string;
  value: string;
  type?: 'plain' | 'encrypted'; // default 'plain'
  target?: ('production' | 'development' | 'preview')[];
}

// update vercel environment variables
export async function updateVercelEnvVars(
  deployDocId: string,
  envVars: VercelEnvVar[]
): Promise<void> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/vercel/env-vars`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      deployDocId,
      envVars: envVars.map((env) => ({
        key: env.key,
        value: env.value,
        type: env.type || 'plain',
        target: env.target || ['production', 'development', 'preview'],
      })),
    }),
  });

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(`Update Vercel Env Vars failed: ${errorMsg}`);
  }
}

//get vercel project info
export async function getVercelProjectInfo(deployDocId: string): Promise<any> {
  const headers = await getHeaders();

  const result = await fetch(
    `${api_url}/api/vercel/get-project/${deployDocId}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Get Vercel Project Info failed: ${errorMsg}`);
  }
}

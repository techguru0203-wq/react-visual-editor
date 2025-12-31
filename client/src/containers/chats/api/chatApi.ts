import { ChatSession } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function getChatHistoryApi(chatSessionId: string) {
  let headers = await getHeaders();

  const result = await fetch(
    `${api_url}/api/chats?chatSessionId=${chatSessionId}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function getChatSessionsApi(userId: string) {
  let headers = await getHeaders();

  const result = await fetch(`${api_url}/api/chats/sessions?userId=${userId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function upsertChatSession({
  id,
  name,
  access,
  status,
}: {
  id?: string;
  name: string;
  access: string;
  status?: string;
}): Promise<ChatSession> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/chats/upsert`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ id, name, access, status }),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error upserting chat session: ' + errorMsg);
  }
  return data;
}

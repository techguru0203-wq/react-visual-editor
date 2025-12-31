import { useQuery } from '@tanstack/react-query';

import { DEFAULT_QUERY_STALE_TIME } from '../../../lib/constants';
import { getChatHistoryApi, getChatSessionsApi } from '../api/chatApi';

export const GET_CHATHISTORY_QUERY_KEY = 'GET_CHATHISTORY_QUERY';
export const GET_USER_CHAT_SESSION_QUERY_KEY =
  'GET_USER_CHAT_SESSION_QUERY_KEY';

export function useChatHistory(chatSessionId: string) {
  return useQuery(
    [GET_CHATHISTORY_QUERY_KEY, chatSessionId],
    async () => getChatHistoryApi(chatSessionId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

export function useUserChatSession(userId: string) {
  return useQuery(
    [GET_USER_CHAT_SESSION_QUERY_KEY, userId],
    async () => getChatSessionsApi(userId),
    {
      staleTime: DEFAULT_QUERY_STALE_TIME,
    }
  );
}

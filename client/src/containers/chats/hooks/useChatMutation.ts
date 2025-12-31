import { ChatSession } from '@prisma/client';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'lodash';

import { useRefreshQueries } from '../../../common/hooks/useRefreshQueries';
import { upsertChatSession } from '../api/chatApi';

const CHAT_QUERY_KEY = 'CHAT_QUERY_KEY';

interface HookArgs {
  onError?: (err: string) => void;
  onSuccess?: (chatSession: ChatSession) => void;
}

export function useChatMutation({
  onError = noop,
  onSuccess = noop,
}: HookArgs) {
  const refreshQueries = useRefreshQueries({
    queryKey: [CHAT_QUERY_KEY],
  });

  return {
    upsertChatSessionMutation: useMutation(upsertChatSession, {
      onSuccess: (chatSession: ChatSession) => {
        onSuccess(chatSession);
        refreshQueries();
      },
      onError,
    }),
  };
}

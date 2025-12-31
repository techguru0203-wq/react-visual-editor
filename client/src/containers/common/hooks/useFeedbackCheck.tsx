import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppModal } from '../../../common/components/AppModal';
import { shouldShowFeedbackApi } from '../api/feedbackApi';

const FEEDBACK_CHECK_KEY = 'FEEDBACK_CHECK';

export function useFeedbackCheck() {
  const { showAppModal } = useAppModal();
  const [hasShownModal, setHasShownModal] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [FEEDBACK_CHECK_KEY],
    queryFn: shouldShowFeedbackApi,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isLoading && data?.shouldShow && !hasShownModal) {
      // Check if user has dismissed the modal before
      const dismissed = localStorage.getItem('feedbackModalDismissed');
      if (!dismissed) {
        showAppModal({ type: 'feedback' });
        setHasShownModal(true);
      } else {
        setShowFloatingButton(true);
      }
    } else if (!isLoading && data?.shouldShow) {
      // If modal was shown but user dismissed it, show floating button
      const dismissed = localStorage.getItem('feedbackModalDismissed');
      if (dismissed) {
        setShowFloatingButton(true);
      }
    }
  }, [data, isLoading, hasShownModal, showAppModal]);

  return {
    showFloatingButton: showFloatingButton && data?.shouldShow,
  };
}

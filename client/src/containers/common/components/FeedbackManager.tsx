import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppModal } from '../../../common/components/AppModal';
import { shouldShowFeedbackApi } from '../api/feedbackApi';

const FEEDBACK_CHECK_KEY = 'FEEDBACK_CHECK';

export function FeedbackManager() {
  const { showAppModal } = useAppModal();
  const [hasShownModal, setHasShownModal] = useState(false);

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
        // Show modal after a short delay to avoid conflicts with other modals
        const timer = setTimeout(() => {
          showAppModal({ type: 'feedback' });
          setHasShownModal(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [data, isLoading, hasShownModal, showAppModal]);

  // Note: Modal dismissal is handled in FeedbackForm component via handleCancel
  // This component just manages when to show the modal initially for first-time users

  return null;
}

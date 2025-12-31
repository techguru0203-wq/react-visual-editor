import { useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet, useLocation } from 'react-router';

import { ModalProvider } from '../../../common/components/AppModal';
import SupportChatbot from '../../../common/components/SupportChatbot';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import trackEvent from '../../../trackingClient';
import { FeedbackManager } from '../../common/components/FeedbackManager';
import SidePanel from './SidePanel';

import '../styles/AppLayout.scss';

export function AppLayout() {
  const { user, hasProfile } = useCurrentUser();

  // console.log('in layout.Main:', user);

  const location = useLocation();

  useEffect(() => {
    // console.log('in layout.Main.useEffect:', location.pathname);
    trackEvent('In App Page View', {
      distinct_id: user.email,
      location_path: location.pathname,
    });
  }, [location.pathname, user.email]);

  return (
    <div className="app-container">
      <ModalProvider>
        <Layout style={{ height: '100%' }}>
          <SidePanel />
          <Layout.Content>
            <Layout.Content className="app-main-area">
              <Outlet />
            </Layout.Content>
          </Layout.Content>
        </Layout>
        {/* Support Chatbot - appears on all authenticated pages */}
        <SupportChatbot />
        {/* Feedback Manager - shows modal for first-time users */}
        <FeedbackManager />
      </ModalProvider>
    </div>
  );
}

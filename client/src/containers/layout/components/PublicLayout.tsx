import { Layout } from 'antd';
import { Outlet } from 'react-router';

import { ModalProvider } from '../../../common/components/AppModal';
import SupportChatbot from '../../../common/components/SupportChatbot';
import { useCurrentUserSafe } from '../../../common/contexts/currentUserContext';
import { LanguageProvider } from '../../../common/contexts/languageContext';
import TopNavBarPublic from './TopNavBarPublic';

import '../styles/PublicLayout.scss';

export function PublicLayout() {
  // Only show chatbot if user is logged in
  const userContext = useCurrentUserSafe();
  const isUserLoggedIn = !!userContext?.user;

  return (
    <div className="app-container--public">
      <LanguageProvider>
        <ModalProvider>
          <Layout style={{ height: '100%' }}>
            <Layout.Header className="app-header--public">
              <TopNavBarPublic />
            </Layout.Header>
            <Layout.Content className="app-main-area--public">
              <Outlet />
            </Layout.Content>
          </Layout>
          {/* Support Chatbot - only show when user is logged in */}
          {isUserLoggedIn && <SupportChatbot />}
        </ModalProvider>
      </LanguageProvider>
    </div>
  );
}

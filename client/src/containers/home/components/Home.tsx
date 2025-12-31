import { useEffect, useState } from 'react';
import { Divider, Flex, Modal, Typography } from 'antd';

import { LanguageSwitcher } from '../../../common/components/LanguageSwitcher';
import { UpdateSubscription } from '../../../common/components/PricingPlansModal/PricingPlans';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import FTUETour from '../../myIssues/components/FTUE';
import { FromCommunity } from './FromCommunity';
import { ProjectCard } from './ProjectCard';

import './Home.scss';

export function Home() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    // Check if user came from pricing signup flow
    const signupFrom = localStorage.getItem('signupFrom');
    if (signupFrom === 'pricing') {
      console.log('User signed up from pricing page, showing pricing modal');
      setShowPricingModal(true);
      // Remove the flag from localStorage
      localStorage.removeItem('signupFrom');
    }
  }, []);

  return (
    <div className="home-page">
      {/* Language Switcher - Top Right Corner - Hide for now */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          color: 'black',
        }}
      >
        <LanguageSwitcher />
      </div>

      <Flex vertical className="home-container">
        <Flex vertical className="home-content">
          <Flex vertical className="home-content-main">
            {!user.firstname?.trim() && <FTUETour openTour={true} />}
            <Typography.Text className="welcome">
              {/* {user.firstname},{' '} */}
              <span className="gradient-text">{t('home.mainTitle')}</span>
            </Typography.Text>
            <div className="welcome-content">{t('home.subtitle')}</div>
          </Flex>
          <Flex className="home-cards" align="center">
            <Flex className="main-cards">
              {/* <OmniflowWelcome /> */}
              <ProjectCard selectedCategory={selectedCategory} />
            </Flex>

            <Divider plain style={{ margin: 0 }}>
              {t('home.appTemplates')}
            </Divider>
          </Flex>
        </Flex>
      </Flex>

      {/* From Community Section */}
      <FromCommunity onCategoryChange={setSelectedCategory} />

      {/* Pricing Modal */}
      <Modal
        title={t('pricing.choosePlan').replace('{plan}', '')}
        open={showPricingModal}
        onCancel={() => setShowPricingModal(false)}
        footer={null}
        width={1200}
        centered
        zIndex={2000}
      >
        <UpdateSubscription
          payload={{
            email: user.email,
            source: 'signup',
            destination: 'pricing',
          }}
        />
      </Modal>
    </div>
  );
}

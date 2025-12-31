import { useCallback, useEffect, useRef, useState } from 'react';
import {
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Flex, Menu, MenuProps, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { Outlet, redirect, useLocation, useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { SUBSCRIPTIONTIERS } from '../../../lib/constants';
import {
  CustomizationPath,
  DevVelocityPath,
  IntegrationPath,
  ReferralPath,
  UsersAdminPath,
} from '../../nav/paths';

export function SettingIndex() {
  return redirect(IntegrationPath);
}

export function Setting() {
  const { isAdmin, subscriptionTier, isReferralEnabled, user } =
    useCurrentUser();
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();

  const items: ItemType[] = [];

  items.push(
    ...[
      {
        label: t('settings.integrations'),
        key: IntegrationPath,
      },
      {
        label: t('settings.userManagement'),
        key: UsersAdminPath,
        disabled: !isAdmin,
      },
      {
        label: t('settings.referral'),
        key: ReferralPath,
      },
      {
        label: t('settings.generationSettings'),
        key: DevVelocityPath,
      },
    ]
  );
  const hasCustomizationAccess =
    isAdmin &&
    (subscriptionTier === SUBSCRIPTIONTIERS.PROFESSIONAL ||
      subscriptionTier === SUBSCRIPTIONTIERS.BUSINESS ||
      subscriptionTier === SUBSCRIPTIONTIERS.ENTERPRISE);

  items.push({
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {t('settings.designCustomization')}
        {!hasCustomizationAccess && (
          <Tooltip title={t('settings.upgradePlanForAccess')}>
            <InfoCircleOutlined
              style={{
                color: 'orange',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                showAppModal({
                  type: 'updateSubscription',
                  payload: {
                    email: user.email,
                    source: 'designCustomization',
                    destination: 'upgradeToTeams',
                    isLowCredits: false,
                  },
                });
              }}
            />
          </Tooltip>
        )}
      </span>
    ),

    key: CustomizationPath,
    disabled: !hasCustomizationAccess,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showArrows, setShowArrows] = useState(false);
  const [current, setCurrent] = useState(IntegrationPath);
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = location.pathname.split('/').pop();

  useEffect(() => {
    setCurrent(activeKey || 'profile');
  }, [location.pathname, activeKey]);

  const onClick: MenuProps['onClick'] = useCallback(
    (e: any) => {
      setCurrent(e.key);
      navigate(e.key, { replace: true });
    },
    [navigate]
  );

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowArrows(scrollWidth > clientWidth);
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => {
      window.removeEventListener('resize', checkScrollability);
    };
  }, []);

  return (
    <div>
      <Typography.Title
        level={4}
        className="main-heading"
        style={{ marginBottom: '0' }}
      >
        Admin
      </Typography.Title>
      <div
        style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
      >
        {showArrows && (
          <LeftOutlined
            onClick={handleScrollLeft}
            style={{
              cursor: 'pointer',
              marginRight: 8,
            }}
          />
        )}
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            overflow: 'scroll',
            whiteSpace: 'nowrap',
            width: '100%',
            borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
          }}
        >
          <Menu
            onClick={onClick}
            selectedKeys={[current]}
            mode="horizontal"
            items={items}
            style={{
              flexWrap: 'nowrap',
              borderColor: 'transparent',
              minWidth: 1000,
            }}
            overflowedIndicator={null}
          />
        </div>
        {showArrows && (
          <RightOutlined
            onClick={handleScrollRight}
            style={{
              cursor: 'pointer',
              marginLeft: 8,
            }}
          />
        )}
      </div>
      <Flex style={{ marginTop: 16, width: '100%' }} justify="center">
        <div style={{ width: '100%', maxWidth: '1200px' }}>
          <Outlet />
        </div>
      </Flex>
    </div>
  );
}

import { useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Menu, MenuProps, Tooltip } from 'antd';
import { useNavigate } from 'react-router';

import {
  IssueBoardPath,
  ProjectOrganizationPath,
  SnapshotPath,
} from '../../containers/nav/paths';
import { SUBSCRIPTIONTIERS } from '../../lib/constants';
import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguage } from '../contexts/languageContext';
import { isFeatureLocked } from '../util/app';
import { useAppModal } from './AppModal';

export interface SecondaryMenuItem {
  label: string;
  key: string;
  link?: string;
}

interface ComponentProps {
  items: ReadonlyArray<SecondaryMenuItem>;
  activeKey?: string;
}

export default function SecondaryMenu({ items, activeKey }: ComponentProps) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(activeKey || items[0].key);
  const navigate = useNavigate();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { showAppModal } = useAppModal();

  // let isBuildingMenusLocked = isFeatureLocked(
  //   subscriptionStatus as string,
  //   subscriptionTier as string
  // );
  let isBuildingMenusLocked = false; // enable workboard for now paywall gate for now
  let isReportMenusLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string,
    SUBSCRIPTIONTIERS.BUSINESS
  );
  const onClick: MenuProps['onClick'] = (e) => {
    console.log('click ', e);
    setCurrent(e.key);
    let item = items.find((item) => item.key === e.key);
    if (item) {
      if (
        (isReportMenusLocked && item.key === SnapshotPath) ||
        (isBuildingMenusLocked &&
          (item.key === ProjectOrganizationPath || item.key === IssueBoardPath))
      ) {
        showAppModal({
          type: 'updateSubscription',
          payload: {
            email: user.email,
            source: 'secondaryMenu',
            destination: isReportMenusLocked
              ? 'ReporterPage'
              : 'BuilderWorkPlan',
          },
        });
      } else {
        navigate(item.link as string);
      }
    }
  };

  return (
    <div
      style={{
        overflow: 'hidden',
        display: 'flex',
        flexWrap: 'nowrap',
        flexGrow: 1,
      }}
    >
      <Menu
        className="secondary-menu"
        onClick={onClick}
        selectedKeys={[current]}
        mode="horizontal"
        style={{
          flexWrap: 'nowrap',
          borderColor: 'transparent',
          lineHeight: '36px',
          width: '100%',
        }}
        items={items.map((item) => {
          let icon = null;
          if (
            isBuildingMenusLocked &&
            (item.key === ProjectOrganizationPath ||
              item.key === IssueBoardPath)
          ) {
            icon = (
              <Tooltip title={t('common.upgradeToPerformance')}>
                <InfoCircleOutlined style={{ color: 'orange' }} />
              </Tooltip>
            );
          } else if (isReportMenusLocked && item.key === SnapshotPath) {
            icon = (
              <Tooltip title={t('common.upgradeToBusiness')}>
                <InfoCircleOutlined style={{ color: 'orange' }} />
              </Tooltip>
            );
          }
          return {
            key: item.key,
            label: item.label,
            icon,
          };
        })}
      />
    </div>
  );
}

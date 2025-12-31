import { useCallback, useRef } from 'react';
import { Progress, Typography } from 'antd';

import { useOrganizationHierarchy } from '../../containers/organization/hooks/useOrganizationHierarchy';
import { FREE_PROJECT_LIMIT } from '../constants';
import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguage } from '../contexts/languageContext';
import { useAppModal } from './AppModal';

export function FreeProjectsCounter() {
  const { t } = useLanguage();
  const { data: organization } = useOrganizationHierarchy();
  const { user } = useCurrentUser();

  const { showAppModal } = useAppModal();
  const showAppModalRef = useRef(showAppModal);
  showAppModalRef.current = showAppModal;

  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;
  const percent = (numProjects / FREE_PROJECT_LIMIT) * 100;
  const color = isLimitReached ? '#FF2D55' : '#FDB034';
  const message = isLimitReached ? (
    t('freeProjects.limitReached')
  ) : (
    <>
      {t('freeProjects.used')
        .replace('{used}', numProjects.toString())
        .replace('{limit}', FREE_PROJECT_LIMIT.toString())}
    </>
  );

  const updateSubscription = useCallback(() => {
    showAppModalRef.current({
      type: 'updateSubscription',
      payload: {
        email: user.email,
        source: 'freeProjectBanner',
        destination: 'newPlan',
        isLowCredits: false, // User hit project limit, not necessarily low on credits
      },
    });
  }, [user.email]);

  return (
    <div style={{ padding: 5 }}>
      <Progress
        percent={percent}
        strokeColor={color}
        showInfo={false}
        size={[200, 14]}
      />
      <div>
        <div style={{ margin: '5px 0' }}>
          <Typography.Text style={{ fontSize: 12 }}>{message}</Typography.Text>
        </div>
        {/* TODO: connect to payment plans popup */}
        <Typography.Link style={{ fontSize: 12 }} onClick={updateSubscription}>
          {t('freeProjects.getUnlimited')}
        </Typography.Link>
      </div>
    </div>
  );
}

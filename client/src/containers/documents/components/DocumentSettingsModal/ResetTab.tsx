import React from 'react';
import { Alert, Button, Typography } from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';

interface ResetTabProps {
  onReset: () => void;
  isResetting: boolean;
  isReadOnly?: boolean;
}

const ResetTab: React.FC<ResetTabProps> = ({
  onReset,
  isResetting,
  isReadOnly = false,
}) => {
  const { t } = useLanguage();

  if (isReadOnly) {
    return null;
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{t('reset.title')}</h3>

      <div style={{ marginBottom: '20px' }}>
        <Alert
          message={t('reset.warning')}
          description={t('reset.warningDesc')}
          type="warning"
          showIcon
          style={{ marginBottom: '20px' }}
        />

        <Typography.Paragraph style={{ color: '#666', marginBottom: '20px' }}>
          <strong>{t('reset.whatWillHappen')}</strong>
        </Typography.Paragraph>

        <ul
          style={{
            color: '#666',
            marginBottom: '20px',
            paddingLeft: '20px',
          }}
        >
          <li>{t('reset.resetProduct')}</li>
          <li>{t('reset.removeChat')}</li>
          <li>{t('reset.keepHistory')}</li>
        </ul>

        <Button
          type="primary"
          danger
          onClick={onReset}
          loading={isResetting}
          style={{ marginBottom: '16px' }}
        >
          {isResetting ? t('reset.resetting') : t('reset.resetApp')}
        </Button>

        <div style={{ color: '#666', fontSize: '12px' }}>
          {t('reset.confirmDesc')}
        </div>
      </div>
    </div>
  );
};

export default ResetTab;

import { Alert, Spin } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';

export function LoadingScreen() {
  const { t } = useLanguage();

  return (
    <Alert
      message={t('layout.loading')}
      description={t('layout.pleaseWait')}
      type="info"
      showIcon
      icon={<Spin />}
      style={{ zIndex: 999, width: '100%' }}
    />
  );
}

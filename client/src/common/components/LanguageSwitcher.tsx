import { GlobalOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space } from 'antd';

import { COLORS } from '../../lib/constants';
import { useLanguage } from '../contexts/languageContext';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    setLanguage(key as 'en' | 'zh');
  };

  const items: MenuProps['items'] = [
    {
      key: 'en',
      label: (
        <Space>
          <span>🇺🇸</span>
          {t('language.english')}
        </Space>
      ),
    },
    {
      key: 'zh',
      label: (
        <Space>
          <span>🇨🇳</span>
          {t('language.chinese')}
        </Space>
      ),
    },
  ];

  const currentLanguageLabel =
    language === 'en' ? t('language.english') : t('language.chinese');
  const currentLanguageFlag = language === 'en' ? '🇺🇸' : '🇨🇳';

  return (
    <Dropdown
      menu={{
        items,
        onClick: handleMenuClick,
        selectedKeys: [language],
      }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        style={{
          color: COLORS.PRIMARY,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          height: '32px',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{currentLanguageFlag}</span>
        <span>{currentLanguageLabel}</span>
      </Button>
    </Dropdown>
  );
}

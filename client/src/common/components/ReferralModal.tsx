import { useEffect, useState } from 'react';
import { EyeOutlined } from '@ant-design/icons';
import { Button, Input, message } from 'antd';

import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguage } from '../contexts/languageContext';

interface ReferralModalProps {
  onSuccess: () => void;
}

export function ReferralModal({ onSuccess }: ReferralModalProps) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [baseUrl, setBaseUrl] = useState<string>('');

  // Set base URL based on environment
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setBaseUrl(`http://${window.location.host}/index`);
    } else {
      setBaseUrl(`https://www.omniflow.team/join`);
    }
  }, []);

  const handleCopyUrl = async () => {
    if (user?.referralCode) {
      try {
        const fullUrl = `${baseUrl}?ref=${user.referralCode}`;
        await navigator.clipboard.writeText(fullUrl);
        message.success(t('referral.urlCopied'));
      } catch (error) {
        console.error('Failed to copy URL:', error);
        message.error(t('referral.urlCopyFailed'));
      }
    }
  };

  const handleCopyMessage = async () => {
    if (user?.referralCode) {
      try {
        const fullUrl = `${baseUrl}?ref=${user.referralCode}`;
        const messageText = t('referral.defaultMessage', {
          referralUrl: fullUrl,
        });
        await navigator.clipboard.writeText(messageText);
        message.success(t('referral.messageCopied'));
      } catch (error) {
        console.error('Failed to copy message:', error);
        message.error(t('referral.messageCopyFailed'));
      }
    }
  };

  const getDefaultMessage = () => {
    if (!user?.referralCode) {
      return t('referral.noCodeAvailable');
    }
    const fullUrl = `${baseUrl}?ref=${user.referralCode}`;
    return t('referral.defaultMessage', { referralUrl: fullUrl });
  };

  return (
    <div>
      <div
        style={{
          marginBottom: '24px',
          color: '#666',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        <div style={{ marginBottom: '8px' }}>{t('referral.getCredits')}</div>
        <div style={{ marginBottom: '8px' }}>
          {t('referral.earnCommission')}
        </div>
        <div>
          <EyeOutlined style={{ marginRight: '6px', color: '#666' }} />
          {t('referral.trackReferrals')}{' '}
          <a
            href={`${window.location.origin}/settings/referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1890ff',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {t('referral.referralPage')}
          </a>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: '500', color: '#333' }}>
          {t('referral.url')}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            value={
              user?.referralCode
                ? `${baseUrl}?ref=${user.referralCode}`
                : t('referral.noCodeAvailable')
            }
            readOnly
            disabled={!user?.referralCode}
            style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #e0f2fe',
              color: '#0369a1',
              fontWeight: '500',
            }}
          />
          <Button
            onClick={handleCopyUrl}
            style={{ borderRadius: '8px' }}
            disabled={!user?.referralCode}
          >
            {t('referral.copy')}
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: '500', color: '#333' }}>
          {t('referral.message')}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <Input.TextArea
            value={getDefaultMessage()}
            readOnly
            disabled={!user?.referralCode}
            rows={4}
            style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #e0f2fe',
              color: '#0369a1',
              resize: 'none',
            }}
          />
          <Button
            onClick={handleCopyMessage}
            style={{ borderRadius: '8px', alignSelf: 'flex-start' }}
            disabled={!user?.referralCode}
          >
            {t('referral.copy')}
          </Button>
        </div>
      </div>
    </div>
  );
}

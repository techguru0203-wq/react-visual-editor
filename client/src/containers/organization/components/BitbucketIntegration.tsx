import { useEffect, useRef, useState } from 'react';
import { LogoutOutlined } from '@ant-design/icons';
import { Button, Card, message, Space, Typography } from 'antd';
import { SiBitbucket } from 'react-icons/si';
import { useLocation } from 'react-router-dom';

import { useLanguage } from '../../../common/contexts/languageContext';
import { BitbucketUserProfile } from '../../../shared/types/bitbucketTypes';
import {
  connectToBitbucketApi,
  disconnectFromBitbucketApi,
  getUserBitbucketProfile,
} from '../../project/api/bitbucketApi';
import { handleBitbucketLogin } from '../../project/components/prototype/BitbucketHandler';

export default function BitbucketIntegration() {
  const [profile, setProfile] = useState<BitbucketUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const processedCodes = useRef(new Set());
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await getUserBitbucketProfile();
        if (res?.userName) {
          setProfile(res);
        }
      } catch (error) {
        console.log('Not connected yet:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    // Only process if we have a code and haven't processed it before
    if (code && !processedCodes.current.has(code)) {
      processedCodes.current.add(code);
      setLoading(true);
      const connect = async () => {
        try {
          const { accessToken, userName, workspace, expiresAt, refreshToken } = await connectToBitbucketApi(code);
          if (accessToken && userName) {
            setProfile({ accessToken, userName, workspace, expiresAt, refreshToken });
            message.success('Bitbucket connected successfully.');
          }
        } catch (err) {
          console.error('Bitbucket OAuth failed:', err);
          message.error('Bitbucket authorization failed');
        } finally {
          setLoading(false);
        }
      };
      
      // Execute connect and then reload after it's finished
      connect();
    }
  }, [location.search]);

  const handleConnect = () => {
    handleBitbucketLogin();
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFromBitbucketApi();
      setProfile(null);
      message.success('Disconnected from Bitbucket');
    } catch (err) {
      console.error('Failed to disconnect Bitbucket:', err);
      message.error('Failed to disconnect Bitbucket');
    }
  };

  return (
    <Card title="Bitbucket Account" style={{ width: 400, margin: '0 auto' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Typography.Text>{t('organization.connectingToBitbucket')}</Typography.Text>
        </div>
      ) : profile ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SiBitbucket style={{ fontSize: 20, color: '#205081' }} />
            <Typography.Text strong>{profile.userName}</Typography.Text>
          </div>
          <Typography.Text type="secondary">
{t('organization.accessToken')}{' '}
            {profile.accessToken.length > 8
              ? `${profile.accessToken.slice(0, 4)}****${profile.accessToken.slice(-4)}`
              : '********'}
          </Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleDisconnect}
            danger
            block
          >
{t('organization.disconnectBitbucket')}
          </Button>
        </Space>
      ) : (
        <Button
          icon={<SiBitbucket style={{ fontSize: 18, color: '#205081' }} />}
          type="primary"
          onClick={handleConnect}
          loading={loading}
          block
        >
{t('organization.connectWithBitbucket')}
        </Button>
      )}
    </Card>
  );
} 
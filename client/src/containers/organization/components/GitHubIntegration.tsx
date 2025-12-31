import { useEffect, useState } from 'react';
import { GithubOutlined, LogoutOutlined } from '@ant-design/icons';
import { Button, Card, message, Space, Typography } from 'antd';
import { useLocation } from 'react-router-dom';

import { useLanguage } from '../../../common/contexts/languageContext';
import { GithubUserProfile } from '../../../shared/types/githubTypes';
import {
  connectToGithubApi,
  disconnectFromGithubApi,
  getUserGithubProfile,
} from '../../project/api/githubApi';
import { handleGitHubLogin } from '../../project/components/prototype/GitHubHandler';

export default function GitHubConnectPage() {
  const [profile, setProfile] = useState<GithubUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  // 初始化获取 GitHub 连接状态
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getUserGithubProfile();
        if (res?.userName) {
          setProfile(res);
        }
      } catch {
        console.log('Not connected yet.');
      }
    };
    fetchProfile();
  }, []);

  // 授权成功后回调处理
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (code) {
      const connect = async () => {
        try {
          const { accessToken, userName } = await connectToGithubApi(code);
          if (accessToken && userName) {
            setProfile({ accessToken, userName });
            const newUrl = location.pathname + location.hash;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (err) {
          console.error('GitHub OAuth failed:', err);
          message.error('GitHub authorization failed');
        }
      };
      connect();
    }
  }, [location.search]);

  const handleConnect = () => {
    handleGitHubLogin();
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFromGithubApi();
      setProfile(null);
      message.success('Disconnected from GitHub');
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
      message.error('Failed to disconnect GitHub');
    }
  };

  return (
    <Card title="GitHub Account" style={{ width: 400, margin: '0 auto' }}>
      {profile ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GithubOutlined style={{ fontSize: 20 }} />
            <Typography.Text strong>{profile.userName}</Typography.Text>
          </div>
          <Typography.Text type="secondary">
{t('organization.accessToken')}{' '}
            {profile.accessToken.length > 8
              ? `${profile.accessToken.slice(
                  0,
                  4
                )}****${profile.accessToken.slice(-4)}`
              : '********'}
          </Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleDisconnect}
            danger
            block
          >
{t('organization.disconnectGitHub')}
          </Button>
        </Space>
      ) : (
        <Button
          icon={<GithubOutlined />}
          type="primary"
          onClick={handleConnect}
          loading={loading}
          block
        >
{t('organization.connectWithGitHub')}
        </Button>
      )}
    </Card>
  );
}

import { useState } from 'react';
import { GithubOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';

import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import trackEvent from '../../../../trackingClient';

interface GitHubComponentProps {
  onConnectGitHub: () => void;
  onUploadToGitHub: () => void;
  isConnected: boolean;
  username: string | null;
  repoUrl: string | null;
  isLoading: boolean;
}

export function GitHubComponent({
  onConnectGitHub,
  onUploadToGitHub,
  isConnected,
  username,
  repoUrl,
  isLoading,
}: GitHubComponentProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { user } = useCurrentUser();

  const handleConnectClick = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await onConnectGitHub();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Flex gap={8}>
      {!isConnected ? (
        <Button
          type="primary"
          icon={<GithubOutlined />}
          onClick={handleConnectClick}
          loading={isConnecting}
          style={{
            backgroundColor: '#1890ff',
            border: 'none',
          }}
        >
          {isConnecting ? 'Connecting...' : 'GitHub'}
        </Button>
      ) : (
        <Flex gap={8}>
          <Button
            type="primary"
            icon={<GithubOutlined />}
            onClick={onUploadToGitHub}
            style={{
              backgroundColor: '#52c41a',
              border: 'none',
            }}
          >
            Upload to GitHub
          </Button>
          {repoUrl && (
            <Button
              icon={<GithubOutlined />}
              onClick={() => {
                window.open(repoUrl, '_blank');
                // track event
                trackEvent('viewGitHubRepo', {
                  distinct_id: user.email,
                  payload: JSON.stringify({
                    repoUrl: repoUrl,
                  }),
                });
              }}
              style={{
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
              }}
            >
              View on GitHub
            </Button>
          )}
        </Flex>
      )}
      {isConnected && username && (
        <div style={{ color: '#666' }}>Connected as {username}</div>
      )}
    </Flex>
  );
}

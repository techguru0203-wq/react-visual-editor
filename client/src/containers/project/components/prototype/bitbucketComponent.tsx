import { useState } from 'react';
import { Button, Flex } from 'antd';
import { SiBitbucket } from 'react-icons/si';

interface BitbucketComponentProps {
  onConnectBitbucket: () => void;
  onUploadToBitbucket: () => void;
  isConnected: boolean;
  username: string | null;
  repoUrl: string | null;
  isLoading: boolean;
}

export function BitbucketComponent({
  onConnectBitbucket,
  onUploadToBitbucket,
  isConnected,
  username,
  repoUrl,
  isLoading,
}: BitbucketComponentProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectClick = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await onConnectBitbucket();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Flex gap={8}>
      {!isConnected ? (
        <Button
          type="primary"
          icon={<SiBitbucket style={{ fontSize: 18, color: '#205081' }} />}
          onClick={handleConnectClick}
          loading={isConnecting}
          style={{ backgroundColor: '#205081', border: 'none' }}
        >
          {isConnecting ? 'Connecting...' : 'Bitbucket'}
        </Button>
      ) : (
        <Flex gap={8}>
          <Button
            type="primary"
            icon={<SiBitbucket style={{ fontSize: 18, color: '#205081' }} />}
            onClick={onUploadToBitbucket}
            style={{ backgroundColor: '#2684FF', border: 'none' }}
          >
            Upload to Bitbucket
          </Button>
          {repoUrl && (
            <Button
              icon={<SiBitbucket style={{ fontSize: 18, color: '#205081' }} />}
              onClick={() => window.open(repoUrl, '_blank')}
              style={{ backgroundColor: '#205081', color: 'white', border: 'none' }}
            >
              View on Bitbucket
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
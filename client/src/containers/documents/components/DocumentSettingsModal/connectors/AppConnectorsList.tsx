import React, { useEffect, useState } from 'react';
import { Card, Button, message, Row, Col, Tag, Popconfirm } from 'antd';
import { CheckCircleOutlined, DisconnectOutlined, ApiOutlined } from '@ant-design/icons';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import {
  AppConnectorConfig,
  ConnectorEnvironment,
  OAuthAppCatalogEntry,
  OAuthProvider,
} from '../../../../../shared/types/connectorTypes';
import {
  getOAuthAppCatalogApi,
  initiateOAuthApi,
  deleteConnectorApi,
} from '../../../api/connectorsApi';

interface AppConnectorsListProps {
  documentId: string;
  environment: ConnectorEnvironment;
  connectors: AppConnectorConfig[];
  onRefresh: () => void;
}

export const AppConnectorsList: React.FC<AppConnectorsListProps> = ({
  documentId,
  environment,
  connectors,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<OAuthAppCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<OAuthProvider | null>(null);

  // Load OAuth app catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const apps = await getOAuthAppCatalogApi();
        setCatalog(apps);
      } catch (error) {
        console.error('Failed to load OAuth app catalog:', error);
      }
    };

    loadCatalog();
  }, []);

  // Check if an app is connected
  const isConnected = (provider: OAuthProvider): AppConnectorConfig | undefined => {
    return connectors.find(c => c.provider === provider && c.connected);
  };

  // Handle OAuth connection
  const handleConnect = async (provider: OAuthProvider) => {
    setConnectingProvider(provider);
    
    try {
      const { authUrl } = await initiateOAuthApi(provider, documentId, environment);

      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'oauth',
        'width=600,height=700,scrollbars=yes'
      );

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'oauth_success') {
          message.success(t('connectors.apps.oauthSuccess'));
          onRefresh();
          setConnectingProvider(null);
          window.removeEventListener('message', handleMessage);
        } else if (event.data?.type === 'oauth_error') {
          message.error(t('connectors.apps.oauthFailed'));
          setConnectingProvider(null);
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setConnectingProvider(null);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      message.error(t('connectors.apps.oauthFailed'));
      setConnectingProvider(null);
    }
  };

  // Handle disconnect
  const handleDisconnect = async (connectorId: string) => {
    setLoading(true);
    try {
      await deleteConnectorApi(documentId, connectorId, environment);
      message.success(t('connectors.deleteSuccess'));
      onRefresh();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      message.error(t('connectors.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: '16px', color: '#666' }}>
        {t('connectors.apps.description')}
      </p>

      <Row gutter={[16, 16]}>
        {catalog.map(app => {
          const connected = isConnected(app.provider);
          
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={app.provider}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  borderColor: connected ? '#52c41a' : '#d9d9d9',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '12px' }}>
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.name}
                        style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                      />
                    ) : (
                      <ApiOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                    )}
                  </div>
                  
                  <h4 style={{ margin: '8px 0 4px' }}>{app.name}</h4>
                  
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginBottom: '12px',
                    minHeight: '36px',
                  }}>
                    {app.description}
                  </p>

                  {connected ? (
                    <div>
                      <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginBottom: '8px' }}>
                        {t('connectors.connected')}
                      </Tag>
                      <div>
                        <Popconfirm
                          title={t('connectors.deleteConfirm')}
                          onConfirm={() => handleDisconnect(connected.id)}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DisconnectOutlined />}
                            loading={loading}
                          >
                            {t('connectors.disconnect')}
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => handleConnect(app.provider)}
                      loading={connectingProvider === app.provider}
                    >
                      {connectingProvider === app.provider
                        ? t('connectors.apps.connecting')
                        : t('connectors.connect')}
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {connectors.length === 0 && catalog.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          {t('connectors.noConnectors')}
        </div>
      )}
    </div>
  );
};


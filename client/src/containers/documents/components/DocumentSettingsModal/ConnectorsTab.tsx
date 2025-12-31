import React, { useEffect, useState } from 'react';
import { Tabs, message, Spin } from 'antd';
import { useLanguage } from '../../../../common/contexts/languageContext';
import {
  ConnectorConfig,
  ConnectorEnvironment,
  CustomApiConnectorConfig,
  McpConnectorConfig,
} from '../../../../shared/types/connectorTypes';
import { getConnectorsApi } from '../../api/connectorsApi';
import { CustomApiList } from './connectors/CustomApiList';
import { McpServerList } from './connectors/McpServerList';

interface ConnectorsTabProps {
  documentId?: string;
  doc?: any;
  environment?: ConnectorEnvironment;
}

export const ConnectorsTab: React.FC<ConnectorsTabProps> = React.memo(
  ({ documentId, doc, environment = 'preview' }) => {
    const { t } = useLanguage();
    const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
    const [loading, setLoading] = useState(false);

    // Extract deployDocId from document meta
    const deployDocId = doc?.meta?.deployDocId as string | undefined;

    // Load connectors from backend
    useEffect(() => {
      if (!documentId) return;

      const loadConnectors = async () => {
        setLoading(true);
        try {
          const result = await getConnectorsApi(documentId, environment);
          const envConnectors =
            environment === 'preview' ? result.preview : result.production;
          setConnectors(envConnectors);
        } catch (error) {
          console.error('Failed to load connectors:', error);
          message.error(t('connectors.saveFailed'));
        } finally {
          setLoading(false);
        }
      };

      loadConnectors();
    }, [documentId, environment, t]);

    // Refresh connectors list
    const refreshConnectors = async () => {
      if (!documentId) return;

      try {
        const result = await getConnectorsApi(documentId, environment);
        const envConnectors =
          environment === 'preview' ? result.preview : result.production;
        setConnectors(envConnectors);
      } catch (error) {
        console.error('Failed to refresh connectors:', error);
      }
    };

    if (!documentId) {
      return <div>{t('connectors.documentIdRequired')}</div>;
    }

    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      );
    }

    const customApiConnectors = connectors.filter(
      (c) => c.type === 'custom_api'
    ) as CustomApiConnectorConfig[];
    const mcpConnectors = connectors.filter(
      (c) => c.type === 'mcp'
    ) as McpConnectorConfig[];

    return (
      <div>
        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>
          {t('connectors.title')}
        </h3>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          {t('connectors.description')}
        </p>

        <Tabs
          defaultActiveKey="custom_api"
          items={[
            {
              key: 'custom_api',
              label: t('connectors.customApi'),
              children: (
                <CustomApiList
                  documentId={documentId}
                  environment={environment}
                  connectors={customApiConnectors}
                  deployDocId={deployDocId}
                  onRefresh={refreshConnectors}
                />
              ),
            },
            {
              key: 'custom_mcp',
              label: t('connectors.customMcp'),
              children: (
                <McpServerList
                  documentId={documentId}
                  environment={environment}
                  connectors={mcpConnectors}
                  onRefresh={refreshConnectors}
                />
              ),
            },
          ]}
        />
      </div>
    );
  }
);

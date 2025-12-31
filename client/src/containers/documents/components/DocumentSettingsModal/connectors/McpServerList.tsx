import React, { useState } from 'react';
import {
  Button,
  Table,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Space,
  Tabs,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import {
  McpConnectorConfig,
  ConnectorEnvironment,
  McpTransportType,
} from '../../../../../shared/types/connectorTypes';
import {
  addConnectorApi,
  updateConnectorApi,
  deleteConnectorApi,
  testConnectorApi,
} from '../../../api/connectorsApi';

interface McpServerListProps {
  documentId: string;
  environment: ConnectorEnvironment;
  connectors: McpConnectorConfig[];
  onRefresh: () => void;
}

interface McpFormData {
  name: string;
  description?: string;
  transportType: McpTransportType;
  serverUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  command?: string;
  args?: string;
  env?: Array<{ key: string; value: string }>;
}

export const McpServerList: React.FC<McpServerListProps> = ({
  documentId,
  environment,
  connectors,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [form] = Form.useForm<McpFormData>();
  const [modalVisible, setModalVisible] = useState(false);
  const [configMode, setConfigMode] = useState<'direct' | 'json'>('direct');
  const [jsonConfig, setJsonConfig] = useState('');
  const [editingConnector, setEditingConnector] =
    useState<McpConnectorConfig | null>(null);
  const [loading, setLoading] = useState(false);

  // Export all MCP connectors as mcp.json format
  const handleExport = () => {
    if (connectors.length === 0) {
      message.warning('No MCP servers to export');
      return;
    }

    const mcpServers: Record<string, any> = {};
    connectors.forEach((connector) => {
      const serverConfig: any = {};

      // Only HTTP transport is supported
      if (connector.serverUrl) serverConfig.url = connector.serverUrl;
      if (connector.customHeaders)
        serverConfig.headers = connector.customHeaders;

      if (connector.description)
        serverConfig.description = connector.description;

      // Use connector name as key (replace spaces with underscores)
      const key = connector.name.replace(/\s+/g, '_').toLowerCase();
      mcpServers[key] = serverConfig;
    });

    const mcpConfig = { mcpServers };
    const jsonString = JSON.stringify(mcpConfig, null, 2);

    // Download as file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-config-${environment}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success('MCP configuration exported');
  };

  // Open modal for batch import
  const handleBatchImport = () => {
    setEditingConnector(null);
    setConfigMode('json');
    setJsonConfig('');
    setModalVisible(true);
  };

  // Open modal for adding new connector
  const handleAdd = () => {
    setEditingConnector(null);
    setConfigMode('direct');
    form.resetFields();
    form.setFieldsValue({
      transportType: 'http',
    });
    setModalVisible(true);
  };

  // Open modal for editing connector
  const handleEdit = (connector: McpConnectorConfig) => {
    setEditingConnector(connector);
    setConfigMode('direct');

    const customHeadersArray = connector.customHeaders
      ? Object.entries(connector.customHeaders).map(([key, value]) => ({
          key,
          value: value as string,
        }))
      : [];

    form.setFieldsValue({
      name: connector.name,
      description: connector.description,
      transportType: 'http',
      serverUrl: connector.serverUrl,
      customHeaders: customHeadersArray,
    });

    setModalVisible(true);
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      if (configMode === 'json') {
        // Parse JSON configuration
        setLoading(true);
        try {
          const parsed = JSON.parse(jsonConfig);

          // Check if it's a batch import (standard mcp.json format)
          if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
            // Batch import: create multiple connectors
            let successCount = 0;
            let errorCount = 0;

            for (const [serverName, serverConfig] of Object.entries(
              parsed.mcpServers
            )) {
              try {
                const config = serverConfig as any;

                // Validate transport type - only HTTP is supported
                if (config.command) {
                  console.error(`STDIO transport not supported: ${serverName}`);
                  errorCount++;
                  continue;
                }

                if (!config.url) {
                  console.error(`Missing server URL: ${serverName}`);
                  errorCount++;
                  continue;
                }

                const connectorData: Omit<
                  McpConnectorConfig,
                  'id' | 'createdAt' | 'updatedAt'
                > = {
                  type: 'mcp' as const,
                  name: config.name || serverName.replace(/_/g, ' '),
                  description: config.description,
                  transportType: 'http',
                  serverUrl: config.url,
                  customHeaders: config.headers,
                  connected: false,
                };

                // Check for duplicate name
                const isDuplicate = connectors.some(
                  (c) =>
                    c.name.toLowerCase() === connectorData.name.toLowerCase()
                );
                if (isDuplicate) {
                  console.error(`Duplicate name: ${connectorData.name}`);
                  errorCount++;
                  continue;
                }

                await addConnectorApi(documentId, environment, connectorData);
                successCount++;
              } catch (error) {
                console.error(`Failed to import ${serverName}:`, error);
                errorCount++;
              }
            }

            if (successCount > 0) {
              message.success(
                `Successfully imported ${successCount} MCP server(s)`
              );
            }
            if (errorCount > 0) {
              message.warning(`Failed to import ${errorCount} MCP server(s)`);
            }
          } else {
            // Single server import (legacy format or direct config)
            // Validate transport type - only HTTP is supported
            if (parsed.command || parsed.transportType === 'stdio') {
              message.error(
                'STDIO transport is not supported. Please use HTTP transport only.'
              );
              setLoading(false);
              return;
            }

            if (!parsed.serverUrl && !parsed.url) {
              message.error('Server URL is required for HTTP transport.');
              setLoading(false);
              return;
            }

            const connectorData: Omit<
              McpConnectorConfig,
              'id' | 'createdAt' | 'updatedAt'
            > = {
              type: 'mcp' as const,
              name: parsed.name || 'MCP Server',
              description: parsed.description,
              transportType: 'http',
              serverUrl: parsed.serverUrl || parsed.url,
              customHeaders: parsed.customHeaders || parsed.headers,
              connected: false,
            };

            if (editingConnector) {
              await updateConnectorApi(
                documentId,
                editingConnector.id,
                environment,
                connectorData
              );
              message.success(t('connectors.saveSuccess'));
            } else {
              await addConnectorApi(documentId, environment, connectorData);
              message.success(t('connectors.saveSuccess'));
            }
          }
        } catch (error) {
          message.error('Invalid JSON format');
          setLoading(false);
          return;
        }
      } else {
        // Use form values
        const values = await form.validateFields();
        setLoading(true);

        // Convert arrays to objects
        const customHeaders: Record<string, string> = {};
        values.customHeaders?.forEach(({ key, value }) => {
          if (key && value) {
            customHeaders[key] = value;
          }
        });

        const env: Record<string, string> = {};
        values.env?.forEach(({ key, value }) => {
          if (key && value) {
            env[key] = value;
          }
        });

        const connectorData: Omit<
          McpConnectorConfig,
          'id' | 'createdAt' | 'updatedAt'
        > = {
          type: 'mcp' as const,
          name: values.name,
          description: values.description,
          transportType: values.transportType,
          serverUrl: values.serverUrl,
          customHeaders:
            Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
          command: values.command,
          args: values.args ? values.args.split(' ') : undefined,
          env: Object.keys(env).length > 0 ? env : undefined,
          connected: false,
        };

        if (editingConnector) {
          await updateConnectorApi(
            documentId,
            editingConnector.id,
            environment,
            connectorData
          );
          message.success(t('connectors.saveSuccess'));
        } else {
          await addConnectorApi(documentId, environment, connectorData);
          message.success(t('connectors.saveSuccess'));
        }
      }

      setModalVisible(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to save MCP connector:', error);
      message.error(t('connectors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (connectorId: string) => {
    setLoading(true);
    try {
      await deleteConnectorApi(documentId, connectorId, environment);
      message.success(t('connectors.deleteSuccess'));
      onRefresh();
    } catch (error) {
      console.error('Failed to delete connector:', error);
      message.error(t('connectors.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Handle test connection
  const handleTest = async (connectorId: string) => {
    setLoading(true);
    try {
      const result = await testConnectorApi(
        documentId,
        connectorId,
        environment
      );
      if (result.success) {
        // Show detailed success message with tools count if available
        const messageText = result.message || t('connectors.testSuccess');
        message.success({
          content: messageText,
          duration: 3,
        });
      } else {
        message.error({
          content: result.message || t('connectors.testFailed'),
          duration: 5,
        });
      }
    } catch (error: any) {
      console.error('Failed to test connector:', error);
      message.error({
        content: error.message || t('connectors.testFailed'),
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('connectors.mcp.serverName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: McpConnectorConfig) => (
        <div>
          <strong>{text}</strong>
          <div style={{ fontSize: '12px', color: '#666' }}>
            HTTP - {record.serverUrl}
          </div>
        </div>
      ),
    },
    {
      title: t('common.action'),
      key: 'actions',
      render: (record: McpConnectorConfig) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleTest(record.id)}
            loading={loading}
          >
            {t('connectors.testConnection')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('connectors.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: 'import',
      label: t('connectors.mcp.batchImport'),
      icon: <UploadOutlined />,
      onClick: handleBatchImport,
    },
    {
      key: 'export',
      label: t('connectors.mcp.exportConfig'),
      icon: <DownloadOutlined />,
      onClick: handleExport,
      disabled: connectors.length === 0,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          {t('connectors.mcp.addNew')}
        </Button>
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button>
            {t('common.more')} <DownOutlined />
          </Button>
        </Dropdown>
      </div>

      <Table
        dataSource={connectors}
        columns={columns}
        rowKey="id"
        pagination={false}
        locale={{
          emptyText: t('connectors.noConnectors'),
        }}
      />

      <Modal
        title={
          editingConnector
            ? t('common.edit')
            : configMode === 'json'
              ? t('connectors.mcp.batchImport')
              : t('connectors.mcp.addNew')
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={
          configMode === 'json' && !editingConnector
            ? t('connectors.mcp.import')
            : t('common.save')
        }
        cancelText={t('common.cancel')}
        confirmLoading={loading}
        width={800}
        className="app-modal-with-footer"
      >
        <Tabs
          activeKey={configMode}
          onChange={
            editingConnector
              ? undefined
              : (key) => setConfigMode(key as 'direct' | 'json')
          }
          items={[
            {
              key: 'direct',
              label: t('connectors.mcp.directConfig'),
              children: (
                <Form form={form} layout="vertical" autoComplete="off">
                  <Form.Item
                    name="name"
                    label={t('connectors.mcp.serverName')}
                    rules={[
                      { required: true, message: 'Please enter a name' },
                      {
                        validator: async (_, value) => {
                          if (!value) return;
                          const isDuplicate = connectors.some(
                            (c) =>
                              c.name.toLowerCase() === value.toLowerCase() &&
                              (!editingConnector ||
                                c.id !== editingConnector.id)
                          );
                          if (isDuplicate) {
                            throw new Error(t('connectors.mcp.duplicateName'));
                          }
                        },
                      },
                    ]}
                  >
                    <Input
                      placeholder={t('connectors.mcp.serverNamePlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item name="description" label={t('common.description')}>
                    <Input.TextArea
                      placeholder={t(
                        'connectors.customApi.descriptionPlaceholder'
                      )}
                      rows={5}
                    />
                  </Form.Item>

                  {/* Transport Type - Hidden, always HTTP */}
                  <Form.Item name="transportType" hidden initialValue="http">
                    <Input />
                  </Form.Item>

                  <Form.Item
                    name="serverUrl"
                    label={t('connectors.mcp.serverUrl')}
                    tooltip={t('connectors.mcp.serverUrlHelp')}
                    rules={[
                      {
                        required: true,
                        message: 'Please enter server URL',
                      },
                    ]}
                  >
                    <Input
                      placeholder={t('connectors.mcp.serverUrlPlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item label={t('connectors.mcp.customHeaders')}>
                    <Form.List name="customHeaders">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Space
                              key={key}
                              style={{ display: 'flex', marginBottom: 8 }}
                              align="baseline"
                            >
                              <Form.Item
                                {...restField}
                                name={[name, 'key']}
                                style={{ marginBottom: 0, flex: 1 }}
                              >
                                <Input
                                  placeholder={t('connectors.mcp.headerName')}
                                />
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'value']}
                                style={{ marginBottom: 0, flex: 1 }}
                              >
                                <Input
                                  placeholder={t('connectors.mcp.headerValue')}
                                />
                              </Form.Item>
                              <MinusCircleOutlined
                                onClick={() => remove(name)}
                              />
                            </Space>
                          ))}
                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => add()}
                              block
                              icon={<PlusOutlined />}
                            >
                              {t('connectors.mcp.addHeader')}
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'json',
              label: t('connectors.mcp.importJson'),
              children: (
                <div>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '6px',
                    }}
                  >
                    <p style={{ marginBottom: '8px', fontWeight: 500 }}>
                      {t('connectors.mcp.jsonFormatHelp')}
                    </p>
                    <pre
                      style={{
                        fontSize: '11px',
                        color: '#666',
                        margin: 0,
                        overflow: 'auto',
                        fontFamily: 'monospace',
                      }}
                    >
                      {`{
  "mcpServers": {
    "microsoft_learn": {
      "url": "https://mcp.microsoft.com",
      "headers": { "Authorization": "Bearer xxx" },
      "description": "Microsoft Learn MCP Server"
    },
    "custom_server": {
      "url": "https://api.example.com/mcp",
      "headers": { "X-API-Key": "your-api-key" },
      "description": "Custom MCP server for API access"
    }
  }
}`}
                    </pre>
                  </div>
                  <Input.TextArea
                    value={jsonConfig}
                    onChange={(e) => setJsonConfig(e.target.value)}
                    placeholder={t('connectors.mcp.jsonPlaceholder')}
                    rows={15}
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

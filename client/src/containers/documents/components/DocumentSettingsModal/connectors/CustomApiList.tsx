import React, { useState, useMemo } from 'react';
import {
  Button,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Tooltip,
  Card,
  Row,
  Col,
  Upload,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import {
  CustomApiConnectorConfig,
  ConnectorEnvironment,
} from '../../../../../shared/types/connectorTypes';
import {
  addConnectorApi,
  updateConnectorApi,
  deleteConnectorApi,
  syncConnectorEnvVarsToVercelApi,
} from '../../../api/connectorsApi';
import { api_url } from '../../../../../lib/constants';
import { getHeaders } from '../../../../../common/util/apiHeaders';
import { RESERVED_ENV_VAR_NAMES } from '../../../../../common/constants';

interface CustomApiListProps {
  documentId: string;
  environment: ConnectorEnvironment;
  connectors: CustomApiConnectorConfig[];
  deployDocId?: string; // Vercel project ID
  onRefresh: () => void;
}

interface CustomApiFormData {
  name: string;
  description?: string;
  iconUrl?: string;
  envVars: Array<{ key: string; value: string }>;
}

// Predefined API templates
interface ApiTemplate {
  name: string;
  description: string;
  iconUrl: string;
  envVarKey: string;
  envVarPlaceholder: string;
}

const API_TEMPLATES: ApiTemplate[] = [
  {
    name: 'Perplexity',
    description:
      'Search real-time information and get accurate answers with reliable citations\nEndpoint: POST https://api.perplexity.ai/chat/completions\nAuth: Bearer token in Authorization header',
    iconUrl:
      'https://s3.us-east-2.amazonaws.com/omniflow.team/user-content/willyCo/cmi2yia8s000tspv26o8jcxhs/1763399579385-favicon.svg',
    envVarKey: 'PERPLEXITY_API_KEY',
    envVarPlaceholder: 'pplx-...',
  },
  {
    name: 'ElevenLabs',
    description:
      'AI voice generation platform for creating realistic speech from text\nEndpoint: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}\nAuth: xi-api-key header',
    iconUrl:
      'https://s3.us-east-2.amazonaws.com/omniflow.team/user-content/willyCo/cmi2yia8s000tspv26o8jcxhs/1763399498907-elevenlabs-symbol.svg',
    envVarKey: 'ELEVENLABS_API_KEY',
    envVarPlaceholder: 'sk_...',
  },
  {
    name: 'Cohere',
    description:
      'Enterprise AI platform for building language understanding into applications\nEndpoint: POST https://api.cohere.ai/v1/generate\nAuth: Bearer token in Authorization header',
    iconUrl:
      'https://s3.us-east-2.amazonaws.com/omniflow.team/user-content/willyCo/cmi2yia8s000tspv26o8jcxhs/1763399652439-cfa97d813ee274435ea3511171067325506da91c9bc0aa3d8a6a322578cd092b.webp',
    envVarKey: 'COHERE_API_KEY',
    envVarPlaceholder: 'co-...',
  },
  {
    name: 'n8n',
    description:
      'Workflow automation platform for connecting apps and automating tasks\nEndpoint: POST/GET https://{your-instance}/webhook/{webhook-id}\nAuth: API key in X-N8N-API-KEY header or query param',
    iconUrl:
      'https://s3.us-east-2.amazonaws.com/omniflow.team/user-content/willyCo/cmi2yia8s000tspv26o8jcxhs/1763399775877-ScreenShot_2025-11-18_011533_382.png',
    envVarKey: 'N8N_API_KEY',
    envVarPlaceholder: 'n8n_api_...',
  },
];

export const CustomApiList: React.FC<CustomApiListProps> = ({
  documentId,
  environment,
  connectors,
  deployDocId,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [form] = Form.useForm<CustomApiFormData>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConnector, setEditingConnector] =
    useState<CustomApiConnectorConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Watch form values for icon preview
  const nameValue = Form.useWatch('name', form);
  const iconUrlValue = Form.useWatch('iconUrl', form);

  // Check if a template is already configured and get the connector
  const getTemplateConnector = (
    template: ApiTemplate
  ): CustomApiConnectorConfig | undefined => {
    return connectors.find(
      (c) =>
        c.name === template.name &&
        c.envVars[template.envVarKey] &&
        c.envVars[template.envVarKey].trim() !== ''
    );
  };

  const isTemplateConfigured = (template: ApiTemplate): boolean => {
    return !!getTemplateConnector(template);
  };

  // Open modal for adding from template
  const handleAddFromTemplate = (template: ApiTemplate) => {
    setEditingConnector(null);
    form.resetFields();
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      iconUrl: template.iconUrl,
      envVars: [{ key: template.envVarKey, value: '' }],
    });
    setModalVisible(true);
  };

  // Open modal for adding new connector
  const handleAdd = () => {
    setEditingConnector(null);
    form.resetFields();
    form.setFieldsValue({
      envVars: [{ key: '', value: '' }],
    });
    setModalVisible(true);
  };

  // Open modal for editing connector
  const handleEdit = (connector: CustomApiConnectorConfig) => {
    setEditingConnector(connector);

    const envVarsArray = Object.entries(connector.envVars).map(
      ([key, value]) => ({
        key,
        value: value as string,
      })
    );

    form.setFieldsValue({
      name: connector.name,
      description: connector.description,
      iconUrl: connector.iconUrl,
      envVars: envVarsArray,
    });

    setModalVisible(true);
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Convert envVars array to object
      const envVars: Record<string, string> = {};
      values.envVars.forEach(({ key, value }) => {
        if (key && value) {
          envVars[key] = value;
        }
      });

      // Require at least one env var with both key and value
      if (Object.keys(envVars).length === 0) {
        message.error(t('connectors.customApi.envVarRequired'));
        setLoading(false);
        return;
      }

      const connector = {
        type: 'custom_api' as const,
        name: values.name,
        description: values.description,
        iconUrl: values.iconUrl,
        envVars,
      };

      if (editingConnector) {
        await updateConnectorApi(
          documentId,
          editingConnector.id,
          environment,
          connector
        );
        message.success(t('connectors.saveSuccess'));
      } else {
        await addConnectorApi(documentId, environment, connector);
        message.success(t('connectors.saveSuccess'));
      }

      // Sync environment variables to Vercel if deployDocId is available
      if (deployDocId) {
        try {
          await syncConnectorEnvVarsToVercelApi(
            documentId,
            deployDocId,
            envVars,
            environment
          );
        } catch (vercelError) {
          console.error('Failed to sync env vars to Vercel:', vercelError);
        }
      }

      // Refresh data first, then close modal
      await onRefresh();
      setModalVisible(false);
    } catch (error) {
      console.error('Failed to save custom API connector:', error);
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
      await onRefresh();
    } catch (error) {
      console.error('Failed to delete connector:', error);
      message.error(t('connectors.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Handle icon upload using presigned URL
  const handleIconUpload = async (file: File): Promise<boolean> => {
    setUploading(true);
    try {
      // Step 1: Get presigned upload URL from server
      const headers = await getHeaders();
      const presignResponse = await fetch(
        `${api_url}/api/files/simple-presign-upload`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            documentId,
            fileName: file.name,
            fileType: file.type,
          }),
        }
      );

      const presignResult = await presignResponse.json();
      if (!presignResult.success || !presignResult.data) {
        throw new Error(presignResult.errorMsg || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = presignResult.data;

      // Step 2: Upload file directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Update form with the public URL
      form.setFieldsValue({ iconUrl: publicUrl });
      message.success(t('files.uploadSuccess'));
      return true;
    } catch (error) {
      console.error('Failed to upload icon:', error);
      message.error(t('files.uploadFailed'));
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Filter templates based on search text
  const filteredTemplates = useMemo(() => {
    if (!searchText.trim()) {
      return API_TEMPLATES;
    }
    const lowerSearch = searchText.toLowerCase();
    return API_TEMPLATES.filter(
      (template) =>
        template.name.toLowerCase().includes(lowerSearch) ||
        template.description.toLowerCase().includes(lowerSearch)
    );
  }, [searchText]);

  // Get custom connectors (not from templates)
  const customConnectors = useMemo(() => {
    const templateNames = API_TEMPLATES.map((t) => t.name);
    return connectors.filter((c) => !templateNames.includes(c.name));
  }, [connectors]);

  // Filter custom connectors based on search text
  const filteredCustomConnectors = useMemo(() => {
    if (!searchText.trim()) {
      return customConnectors;
    }
    const lowerSearch = searchText.toLowerCase();
    return customConnectors.filter(
      (connector) =>
        connector.name.toLowerCase().includes(lowerSearch) ||
        (connector.description &&
          connector.description.toLowerCase().includes(lowerSearch))
    );
  }, [customConnectors, searchText]);

  // Separate configured and unconfigured templates
  const { configuredTemplates, unconfiguredTemplates } = useMemo(() => {
    const configured: ApiTemplate[] = [];
    const unconfigured: ApiTemplate[] = [];

    filteredTemplates.forEach((template) => {
      if (isTemplateConfigured(template)) {
        configured.push(template);
      } else {
        unconfigured.push(template);
      }
    });

    return {
      configuredTemplates: configured,
      unconfiguredTemplates: unconfigured,
    };
  }, [filteredTemplates, connectors]);

  return (
    <div>
      {/* Search bar */}
      <Input
        placeholder={t('connectors.customApi.search')}
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: '16px' }}
        allowClear
      />

      {/* Info banner */}
      <div
        style={{
          background: '#f5f5f5',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '18px' }}>🔑</span>
        <span style={{ color: '#666', fontSize: '14px' }}>
          {t('connectors.customApi.connectInfo')}
        </span>
      </div>

      {/* All API connectors grid: Add Custom API template (always first) + Configured templates + Custom connectors + Unconfigured templates */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* 0. Add Custom API template - Always fixed at first position */}
        <Col xs={24} sm={12}>
          <Card
            hoverable
            onClick={handleAdd}
            style={{
              cursor: 'pointer',
              border: '2px dashed #1890ff',
              background: '#fafafa',
              position: 'relative',
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: '#fff',
                }}
              >
                <PlusOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    marginBottom: '4px',
                    color: '#1890ff',
                  }}
                >
                  {t('connectors.customApi.addNew')}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    lineHeight: '1.4',
                  }}
                >
                  {t('connectors.customApi.addNewDescription')}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 1. Configured templates */}
        {configuredTemplates.map((template) => {
          const connector = getTemplateConnector(template)!;
          return (
            <Col xs={24} sm={12} key={template.name}>
              <Card
                hoverable
                onClick={() => handleEdit(connector)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid #52c41a',
                  position: 'relative',
                }}
                bodyStyle={{ padding: '16px', paddingRight: '48px' }}
              >
                <CheckCircleOutlined
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    fontSize: '20px',
                    color: '#52c41a',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <img
                    src={template.iconUrl}
                    alt={template.name}
                    crossOrigin="anonymous"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="20"%3E' +
                        template.name[0] +
                        '%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        marginBottom: '4px',
                      }}
                    >
                      {template.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {template.description}
                    </div>
                  </div>
                </div>
                {/* Delete action */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Popconfirm
                    title={t('connectors.deleteConfirm')}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(connector.id);
                    }}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          );
        })}

        {/* 2. Custom connectors (user-created) */}
        {filteredCustomConnectors.map((connector) => {
          return (
            <Col xs={24} sm={12} key={connector.id}>
              <Card
                hoverable
                onClick={() => handleEdit(connector)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid #52c41a',
                  position: 'relative',
                }}
                bodyStyle={{ padding: '16px', paddingRight: '48px' }}
              >
                <CheckCircleOutlined
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    fontSize: '20px',
                    color: '#52c41a',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  {connector.iconUrl ? (
                    <img
                      src={connector.iconUrl}
                      alt={connector.name}
                      crossOrigin="anonymous"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="20"%3E' +
                          connector.name[0] +
                          '%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#666',
                      }}
                    >
                      {connector.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        marginBottom: '4px',
                      }}
                    >
                      {connector.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {connector.description ||
                        `${Object.keys(connector.envVars).length} variable(s)`}
                    </div>
                  </div>
                </div>
                {/* Delete action */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Popconfirm
                    title={t('connectors.deleteConfirm')}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(connector.id);
                    }}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          );
        })}

        {/* 3. Unconfigured templates */}
        {unconfiguredTemplates.map((template) => {
          return (
            <Col xs={24} sm={12} key={template.name}>
              <Card
                hoverable
                onClick={() => handleAddFromTemplate(template)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid #d9d9d9',
                  position: 'relative',
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <img
                    src={template.iconUrl}
                    alt={template.name}
                    crossOrigin="anonymous"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="20"%3E' +
                        template.name[0] +
                        '%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        marginBottom: '4px',
                      }}
                    >
                      {template.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {template.description}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title={
          editingConnector ? t('common.edit') : t('connectors.customApi.addNew')
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={loading}
        width={700}
        className="app-modal-with-footer"
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="name"
            label={t('connectors.customApi.name')}
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder={t('connectors.customApi.namePlaceholder')} />
          </Form.Item>

          {/* Hidden Form.Item to track iconUrl */}
          <Form.Item name="iconUrl" hidden>
            <Input />
          </Form.Item>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '8px', color: 'rgba(0, 0, 0, 0.85)' }}>
              {t('connectors.customApi.iconUrl')}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Icon Preview */}
              <div style={{ flexShrink: 0 }}>
                {iconUrlValue ? (
                  <img
                    src={iconUrlValue}
                    alt="Icon preview"
                    crossOrigin="anonymous"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                      border: '1px solid #d9d9d9',
                    }}
                    onError={(e) => {
                      // Fallback to first letter if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.fallback-icon')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-icon';
                        fallback.style.cssText = `
                          width: 48px;
                          height: 48px;
                          borderRadius: 8px;
                          backgroundColor: #f0f0f0;
                          display: flex;
                          alignItems: center;
                          justifyContent: center;
                          fontSize: 24px;
                          fontWeight: 600;
                          color: #666;
                          border: 1px solid #d9d9d9;
                        `;
                        fallback.textContent = (
                          nameValue?.[0] || '?'
                        ).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 600,
                      color: '#666',
                      border: '1px solid #d9d9d9',
                    }}
                  >
                    {(nameValue?.[0] || '?').toUpperCase()}
                  </div>
                )}
              </div>
              {/* Upload Button */}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  handleIconUpload(file);
                  return false;
                }}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploading}
                  disabled={uploading}
                >
                  {t('common.upload')}
                </Button>
              </Upload>
            </div>
          </div>

          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea
              placeholder={t('connectors.customApi.descriptionPlaceholder')}
              rows={5}
            />
          </Form.Item>

          <Form.Item
            label={
              <span>
                {t('connectors.customApi.envVars')}{' '}
                <Tooltip title={t('connectors.customApi.envVarsTooltip')}>
                  <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </span>
            }
          >
            <Form.List name="envVars">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div
                      key={key}
                      style={{
                        background: '#fafafa',
                        border: '1px solid #d9d9d9',
                        borderRadius: '8px',
                        padding: '20px',
                        marginBottom: '16px',
                        position: 'relative',
                      }}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          remove(name);
                        }}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          zIndex: 10,
                        }}
                      />

                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        label={
                          <span style={{ fontWeight: 600, color: '#262626' }}>
                            Secret name
                          </span>
                        }
                        style={{ marginBottom: '16px' }}
                        rules={[
                          {
                            pattern: /^[A-Z_]*$/,
                            message: t(
                              'connectors.customApi.secretNamePattern'
                            ),
                          },
                          {
                            validator: (_, value) => {
                              if (
                                value &&
                                RESERVED_ENV_VAR_NAMES.includes(value)
                              ) {
                                return Promise.reject(
                                  new Error(
                                    t('connectors.customApi.reservedName')
                                  )
                                );
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input
                          placeholder="SOME_UNIQUE_KEY_NAME"
                          style={{
                            background: '#fff',
                            fontSize: '14px',
                          }}
                          onChange={(e) => {
                            const upperValue = e.target.value.toUpperCase();
                            const envVars = form.getFieldValue('envVars');
                            envVars[name].key = upperValue;
                            form.setFieldsValue({ envVars });
                          }}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        label={
                          <span style={{ fontWeight: 600, color: '#262626' }}>
                            Value
                          </span>
                        }
                        style={{ marginBottom: 0 }}
                      >
                        <Input.TextArea
                          placeholder="Value of the secret, such as sk-example-1234"
                          rows={3}
                          style={{
                            background: '#fff',
                            fontSize: '14px',
                          }}
                        />
                      </Form.Item>
                    </div>
                  ))}
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                    >
                      {t('connectors.customApi.addEnvVar')}
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

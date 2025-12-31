import React, { useEffect, useState } from 'react';
import { SaveOutlined } from '@ant-design/icons';
import { DOCTYPE, Prisma } from '@prisma/client';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  message,
  Modal,
  Row,
  Select,
  Typography,
} from 'antd';

import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url } from '../../../../lib/constants';
import { normalizeEnvSettings } from '../../../../shared/utils';
import { updateDocumentSettings } from '../../api/documentSettingsApi';

const { Title, Text } = Typography;

// Available AI models
const AI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  //{ value: 'gemini-2.5-flash-image', label: 'Nano Banana' },
];

interface AIModelTabProps {
  documentId?: string;
  doc?: any;
  isReadOnly?: boolean;
  onClose?: () => void;
  onTriggerRedeployment?: () => void;
  environment?: 'preview' | 'production';
}

export const AIModelTab: React.FC<AIModelTabProps> = ({
  documentId,
  doc,
  isReadOnly = false,
  onClose,
  onTriggerRedeployment,
  environment = 'preview',
}) => {
  const { t } = useLanguage();
  const { organization } = useCurrentUser();
  const [llmModelName, setLlmModelName] = useState<string>('');
  const [omniflowApiKey, setOmniflowApiKey] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load LLM model name from document meta and API key from organization
  useEffect(() => {
    const meta = doc?.meta as Prisma.JsonObject;
    const envSettings = normalizeEnvSettings(
      meta?.envSettings,
      environment
    ) as Prisma.JsonObject;

    // Load model name from document settings (default to GPT-4o-mini)
    if (envSettings && envSettings.LLM_MODEL_NAME) {
      setLlmModelName(envSettings.LLM_MODEL_NAME as string);
    } else {
      setLlmModelName('gpt-4o-mini'); // Default to GPT-4o-mini
    }

    // Load API key from organization (already available in context)
    console.log('Loading organization API key:', organization);
    const orgApiKey = (organization as any)?.apiKey;
    if (orgApiKey) {
      setOmniflowApiKey(orgApiKey as string);
    }
  }, [doc?.meta, organization, environment]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setOmniflowApiKey(newValue);
  };

  const handleSave = async () => {
    if (!documentId) {
      message.error(t('message.documentIdRequired'));
      return;
    }

    if (!organization?.id) {
      message.error(t('message.organizationIdRequired'));
      return;
    }

    setLoading(true);
    try {
      const meta = doc?.meta as Prisma.JsonObject;
      const allEnvSettings = (meta?.envSettings as any) || {};

      // Check if using new structure
      const isNewStructure =
        allEnvSettings.preview || allEnvSettings.production;

      let updatedEnvSettings: any;
      if (isNewStructure) {
        // New structure: update only current environment
        updatedEnvSettings = {
          ...allEnvSettings,
          [environment]: {
            ...(allEnvSettings[environment] || {}),
            LLM_MODEL_NAME: llmModelName,
            OMNIFLOW_API_KEY: omniflowApiKey,
          },
        };
      } else {
        // Old structure or first time: create new structure
        const currentSettings = {
          ...allEnvSettings,
          LLM_MODEL_NAME: llmModelName,
          OMNIFLOW_API_KEY: omniflowApiKey,
        };

        // Save to current environment only
        if (environment === 'preview') {
          updatedEnvSettings = {
            preview: currentSettings,
            production: allEnvSettings.production || {},
          };
        } else {
          // Saving to production: keep old data in preview
          updatedEnvSettings = {
            preview: allEnvSettings.preview || allEnvSettings || {},
            production: currentSettings,
          };
        }
      }

      // Check if nothing changed
      const currentEnvSettings = normalizeEnvSettings(
        meta?.envSettings,
        environment
      ) as any;
      if (
        omniflowApiKey &&
        omniflowApiKey === (organization as Prisma.JsonObject)?.apiKey &&
        llmModelName === currentEnvSettings.LLM_MODEL_NAME
      ) {
        return;
      }

      // need to store model name and add through envSettings during deployment
      const result = await updateDocumentSettings(documentId, {
        envSettings: updatedEnvSettings,
      });

      if (!result.success) {
        message.error(result.errorMsg || t('apiKeys.saveFailed'));
        return;
      }

      // Update organization API key
      try {
        const headers = await getHeaders();
        const response = await fetch(`${api_url}/api/organization/update`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: (organization as any)?.id,
            apiKey: omniflowApiKey,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.message || 'Failed to update organization API key'
          );
        }

        // Trigger redeployment if this is a deployed document (PROTOTYPE or PRODUCT)
        if (doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT) {
          triggerRedeployment();
        }
      } catch (error) {
        console.error('Error updating organization API key:', error);
        message.error(t('apiKeys.saveFailed'));
      }
    } catch (error) {
      console.error('Error saving LLM model settings:', error);
      message.error(t('apiKeys.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const triggerRedeployment = () => {
    // Show confirmation modal
    const confirmModal = Modal.confirm({
      title: t('apiKeys.redeploymentTitle'),
      content: t('apiKeys.redeploymentContent'),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      onOk: () => {
        // Close the confirmation modal immediately
        confirmModal.destroy();

        // Close the DocumentSettings modal immediately
        if (onClose) {
          onClose();
        }

        // Trigger redeployment in the parent component (streaming editor)
        if (onTriggerRedeployment) {
          onTriggerRedeployment();
        }
      },
    });
  };

  return (
    <div>
      <Card style={{ marginTop: '16px' }}>
        <Title level={4}>{t('apiKeys.llmModelConfig')}</Title>
        <Alert
          message={t('apiKeys.changeWarningContent')}
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
        <Row gutter={16} style={{ marginTop: '24px', marginBottom: '16px' }}>
          <Col span={12}>
            <Text strong>{t('apiKeys.llmModelName')}</Text>
            <br />
            <Select
              key="llm-model-select"
              value={llmModelName}
              onChange={(value) => setLlmModelName(value)}
              placeholder={t('apiKeys.modelPlaceholder')}
              style={{ marginTop: '8px', width: '100%' }}
              disabled={isReadOnly}
              options={AI_MODELS}
            />
          </Col>
          <Col span={12}>
            <Text strong>{t('apiKeys.omniflowApiKey')}</Text>
            <br />
            <Input.Password
              key="llm-api-key-input"
              value={omniflowApiKey}
              onChange={handleApiKeyChange}
              placeholder={t('apiKeys.apiKeyPlaceholder')}
              style={{ marginTop: '8px' }}
              disabled={isReadOnly}
            />
          </Col>
        </Row>

        <Row justify="end" style={{ marginTop: '16px' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
            disabled={isReadOnly}
          >
            {t('common.save')}
          </Button>
        </Row>
      </Card>
    </div>
  );
};

export default AIModelTab;

import { useEffect, useState } from 'react';
import { Prisma } from '@prisma/client';
import { Button, Flex, Form, Input, message, Modal, Spin } from 'antd';

import { getDocumentApi } from '../../../documents/api/getDocumentApi';
import { resetDatabase } from '../../api/databaseApi';
import { upsertDocument } from '../../api/document';
import { EnvSettings } from './PrototypeDataBaseHandler';

interface ProtoTypeDataShowProps {
  onClose: () => void;
  data: any[];
  documentId: string;
}

export default function PrototypeDataShow({
  onClose,
  documentId,
}: ProtoTypeDataShowProps) {
  const [isLoadingEnv, setIsLoadingEnv] = useState(true);
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [envSettings, setEnvSettings] = useState<EnvSettings | null>(null);
  const [form] = Form.useForm();

  // Load environment settings
  useEffect(() => {
    if (documentId) {
      setIsLoadingEnv(true);
      getDocumentApi(documentId)
        .then((document) => {
          const envSettings =
            typeof document?.meta === 'object' && !Array.isArray(document?.meta)
              ? (document.meta as any).envSettings
              : undefined;

          console.log('Environment settings loaded:', envSettings);

          if (envSettings) {
            setEnvSettings(envSettings as EnvSettings);
            form.setFieldsValue(envSettings);
          } else {
            // No settings found, go straight to edit mode
            setIsEditing(true);
          }
        })
        .catch((error) => {
          console.error('Error loading document meta:', error);
          message.error('Error loading configuration');
        })
        .finally(() => {
          setIsLoadingEnv(false);
        });
    }
  }, [documentId, form]);

  const handleSaveEnvironmentSettings = async (values: EnvSettings) => {
    if (!documentId) return;

    setIsSavingEnv(true);
    try {
      // Create a meta object that conforms to JsonObject
      const metaObj: Prisma.JsonObject = {
        envSettings: values as unknown as Prisma.JsonObject,
      };

      // Update the document meta with env settings
      await upsertDocument({
        id: documentId,
        meta: metaObj,
      });

      setEnvSettings(values);
      setIsEditing(false);
      message.success('Environment settings saved successfully');
    } catch (error) {
      console.error('Error saving environment settings:', error);
      message.error('Failed to save environment settings');
    } finally {
      setIsSavingEnv(false);
    }
  };

  const handleResetDatabase = () => {
    Modal.confirm({
      title: 'Reset Database',
      content:
        'This will permanently drop all tables and data, then rerun database migrations to recreate the database. This action cannot be undone. Are you sure you want to continue?',
      okText: 'Reset Database',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setIsSavingEnv(true);
          const result = await resetDatabase(documentId);
          if (result.success) {
            let successMessage = `Successfully dropped ${
              result.data.tablesDropped
            } tables: ${result.data.tables.join(', ')}`;

            if (result.data.filesExecuted !== undefined) {
              successMessage += `\nMigrations rerun successfully (${result.data.filesExecuted} files executed)`;
            } else if (result.data.migrationError) {
              successMessage += `\n⚠️ Migration rerun failed: ${result.data.migrationError}`;
            }

            message.success(successMessage);
            // Reload the page or refresh data
            window.location.reload();
          } else {
            throw new Error('Failed to reset database');
          }
        } catch (error) {
          console.error('Error resetting database:', error);
          message.error(
            error instanceof Error ? error.message : 'Failed to reset database'
          );
        } finally {
          setIsSavingEnv(false);
        }
      },
    });
  };

  // Render environment settings display
  const renderEnvironmentSettingsDisplay = () => (
    <div style={{ padding: '20px' }}>
      <h3>Database Configuration</h3>
      <Flex vertical gap="small" style={{ marginTop: '16px' }}>
        <div>
          <div style={{ fontWeight: 'bold' }}>Database URL:</div>
          <div
            style={{
              padding: '8px',
              background: '#f5f5f5',
              borderRadius: '4px',
              marginTop: '4px',
              wordBreak: 'break-all',
            }}
          >
            {envSettings?.DATABASE_URL || 'Not configured'}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ fontWeight: 'bold' }}>JWT Secret:</div>
          <div
            style={{
              padding: '8px',
              background: '#f5f5f5',
              borderRadius: '4px',
              marginTop: '4px',
            }}
          >
            {envSettings?.JWT_SECRET ? '••••••••••••••••' : 'Not configured'}
          </div>
        </div>

        <Flex
          gap="small"
          style={{ marginTop: '16px', alignSelf: 'flex-start' }}
        >
          <Button type="primary" onClick={() => setIsEditing(true)}>
            Edit Configuration
          </Button>
          <Button danger onClick={handleResetDatabase} loading={isSavingEnv}>
            Reset Database
          </Button>
        </Flex>
      </Flex>
    </div>
  );

  // Render environment settings form
  const renderEnvironmentSettingsForm = () => (
    <div style={{ padding: '20px' }}>
      <h3>Database Configuration</h3>
      <p>Configure your database connection settings:</p>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveEnvironmentSettings}
      >
        <Form.Item
          name="DATABASE_URL"
          label="Database URL"
          rules={[{ required: true, message: 'Database URL is required' }]}
        >
          <Input placeholder="postgresql://username:password@hostname:port/database" />
        </Form.Item>

        <Form.Item
          name="JWT_SECRET"
          label="JWT Secret"
          rules={[{ required: true, message: 'JWT Secret is required' }]}
        >
          <Input placeholder="Your JWT secret key" />
        </Form.Item>

        <Form.Item>
          <Flex gap="small">
            <Button type="primary" htmlType="submit" loading={isSavingEnv}>
              Save Configuration
            </Button>
            {envSettings && (
              <Button
                onClick={() => {
                  setIsEditing(false);
                  form.setFieldsValue(envSettings);
                }}
              >
                Cancel
              </Button>
            )}
          </Flex>
        </Form.Item>
      </Form>
    </div>
  );

  return (
    <Modal
      title="Database Configuration"
      open={true}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Spin spinning={isLoadingEnv}>
        {isLoadingEnv ? (
          <div style={{ height: '300px' }}></div>
        ) : isEditing ? (
          renderEnvironmentSettingsForm()
        ) : (
          renderEnvironmentSettingsDisplay()
        )}
      </Spin>
    </Modal>
  );
}

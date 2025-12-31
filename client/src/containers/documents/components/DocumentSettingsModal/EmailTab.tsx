import { useEffect, useMemo, useState } from 'react';
import {
  AmazonOutlined,
  CloudServerOutlined,
  MailOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Space,
  Switch,
  Typography,
} from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { normalizeEnvSettings } from '../../../../shared/utils';
import { updateVercelEnvVars } from '../../../project/api/vercelApi';
import { updateDocumentSettings } from '../../api/documentSettingsApi';

type EmailProvider = 'SMTP' | 'SENDGRID' | 'MAILGUN' | 'RESEND' | 'AWS_SES';

interface EmailTabProps {
  documentId?: string;
  doc?: any;
  deployDocId?: string;
  isReadOnly?: boolean;
  environment?: 'preview' | 'production';
  onDocMetaUpdate?: (updatedMeta: any) => void;
}

const PROVIDER_LABELS: Record<EmailProvider, string> = {
  SMTP: 'SMTP',
  SENDGRID: 'SendGrid',
  MAILGUN: 'Mailgun',
  RESEND: 'Resend',
  AWS_SES: 'AWS SES',
};

const PROVIDER_ICONS: Record<EmailProvider, React.ReactNode> = {
  SMTP: <MailOutlined style={{ display: 'block' }} />,
  SENDGRID: <SendOutlined style={{ display: 'block' }} />,
  MAILGUN: <CloudServerOutlined style={{ display: 'block' }} />,
  RESEND: <ThunderboltOutlined style={{ display: 'block' }} />,
  AWS_SES: <AmazonOutlined style={{ display: 'block' }} />,
};

const EmailTab: React.FC<EmailTabProps> = ({
  documentId,
  doc,
  deployDocId,
  isReadOnly = false,
  environment = 'preview',
  onDocMetaUpdate,
}) => {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [provider, setProvider] = useState<EmailProvider>('SMTP');

  const existingEnv = useMemo(() => {
    return normalizeEnvSettings(doc?.meta?.envSettings, environment) as Record<
      string,
      string
    >;
  }, [doc?.meta?.envSettings, environment]);

  useEffect(() => {
    // Initialize provider based on env or heuristic
    const initialProvider =
      (existingEnv.EMAIL_PROVIDER as EmailProvider) ||
      (existingEnv.EMAIL_HOST
        ? 'SMTP'
        : existingEnv.SENDGRID_API_KEY
          ? 'SENDGRID'
          : existingEnv.MAILGUN_API_KEY && existingEnv.MAILGUN_DOMAIN
            ? 'MAILGUN'
            : existingEnv.RESEND_API_KEY
              ? 'RESEND'
              : existingEnv.AWS_REGION
                ? 'AWS_SES'
                : 'SMTP');
    setProvider(initialProvider);

    // Set initial form values from env
    form.setFieldsValue({
      EMAIL_PROVIDER: initialProvider,
      ADMIN_EMAIL: existingEnv.ADMIN_EMAIL || '',
      EMAIL_FROM: existingEnv.EMAIL_FROM || '',
      // SMTP
      EMAIL_HOST: existingEnv.EMAIL_HOST || '',
      EMAIL_PORT: existingEnv.EMAIL_PORT
        ? Number(existingEnv.EMAIL_PORT)
        : undefined,
      EMAIL_SECURE: existingEnv.EMAIL_SECURE
        ? existingEnv.EMAIL_SECURE === 'true'
        : true,
      EMAIL_USER: existingEnv.EMAIL_USER || '',
      EMAIL_PASSWORD: existingEnv.EMAIL_PASSWORD || '',
      // SendGrid
      SENDGRID_API_KEY: existingEnv.SENDGRID_API_KEY || '',
      // Mailgun
      MAILGUN_API_KEY: existingEnv.MAILGUN_API_KEY || '',
      MAILGUN_DOMAIN: existingEnv.MAILGUN_DOMAIN || '',
      // Resend
      RESEND_API_KEY: existingEnv.RESEND_API_KEY || '',
      // AWS SES
      AWS_REGION: existingEnv.AWS_REGION || '',
      AWS_ACCESS_KEY_ID: existingEnv.AWS_ACCESS_KEY_ID || '',
      AWS_SECRET_ACCESS_KEY: existingEnv.AWS_SECRET_ACCESS_KEY || '',
    });
  }, [existingEnv, form]);

  const onProviderChange = (e: any) => {
    setProvider(e.target.value as EmailProvider);
    form.setFieldValue('EMAIL_PROVIDER', e.target.value);
  };

  const buildEnvForProvider = (
    values: any
  ): { key: string; value: string }[] => {
    const base: { key: string; value: string }[] = [
      { key: 'EMAIL_PROVIDER', value: values.EMAIL_PROVIDER },
      { key: 'ADMIN_EMAIL', value: values.ADMIN_EMAIL || '' },
      { key: 'EMAIL_FROM', value: values.EMAIL_FROM || '' },
    ];

    switch (values.EMAIL_PROVIDER as EmailProvider) {
      case 'SMTP':
        return base.concat([
          { key: 'EMAIL_HOST', value: values.EMAIL_HOST || '' },
          {
            key: 'EMAIL_PORT',
            value: values.EMAIL_PORT ? String(values.EMAIL_PORT) : '',
          },
          {
            key: 'EMAIL_SECURE',
            value: values.EMAIL_SECURE ? 'true' : 'false',
          },
          { key: 'EMAIL_USER', value: values.EMAIL_USER || '' },
          { key: 'EMAIL_PASSWORD', value: values.EMAIL_PASSWORD || '' },
        ]);
      case 'SENDGRID':
        return base.concat([
          { key: 'SENDGRID_API_KEY', value: values.SENDGRID_API_KEY || '' },
        ]);
      case 'MAILGUN':
        return base.concat([
          { key: 'MAILGUN_API_KEY', value: values.MAILGUN_API_KEY || '' },
          { key: 'MAILGUN_DOMAIN', value: values.MAILGUN_DOMAIN || '' },
        ]);
      case 'RESEND':
        return base.concat([
          { key: 'RESEND_API_KEY', value: values.RESEND_API_KEY || '' },
        ]);
      case 'AWS_SES':
        return base.concat([
          { key: 'AWS_REGION', value: values.AWS_REGION || '' },
          { key: 'AWS_ACCESS_KEY_ID', value: values.AWS_ACCESS_KEY_ID || '' },
          {
            key: 'AWS_SECRET_ACCESS_KEY',
            value: values.AWS_SECRET_ACCESS_KEY || '',
          },
        ]);
      default:
        return base;
    }
  };

  const onSave = async () => {
    try {
      if (!documentId) {
        message.error(t('email.documentIdRequired'));
        return;
      }
      const values = await form.validateFields();
      setIsSaving(true);

      // Get all existing envSettings
      const allEnvSettings = (doc?.meta?.envSettings as any) || {};

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
          },
        };

        const pairs = buildEnvForProvider(values);
        pairs.forEach(({ key, value }) => {
          updatedEnvSettings[environment][key] = value;
        });
      } else {
        // Old structure or first time: create new structure
        const currentSettings = { ...allEnvSettings };
        const pairs = buildEnvForProvider(values);
        pairs.forEach(({ key, value }) => {
          currentSettings[key] = value;
        });

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

      const result = await updateDocumentSettings(documentId, {
        envSettings: updatedEnvSettings,
      });
      if (!result.success) {
        throw new Error(result.errorMsg || t('email.settingsFailed'));
      }

      // Update the local doc object to reflect the new settings
      if (doc && onDocMetaUpdate) {
        const updatedMeta = {
          ...doc.meta,
          envSettings: updatedEnvSettings,
        };
        onDocMetaUpdate(updatedMeta);
      }

      // Also push to Vercel immediately (only current environment vars)
      const pairs = buildEnvForProvider(values);
      await updateVercelEnvVars(
        deployDocId || '',
        pairs.map((p) => ({
          key: p.key,
          value: p.value,
          target: [environment],
        }))
      );

      message.success(t('email.settingsSaved'));
    } catch (err: any) {
      console.error('Failed to save email settings:', err);
      message.error(err?.message || t('email.settingsFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const ProviderSpecificFields = () => {
    if (provider === 'SMTP') {
      return (
        <>
          <Form.Item
            label={t('email.smtpHost')}
            name="EMAIL_HOST"
            rules={[{ required: true, message: t('email.smtpHostRequired') }]}
          >
            <Input disabled={isReadOnly} placeholder="smtp.example.com" />
          </Form.Item>
          <Form.Item
            label={t('email.smtpPort')}
            name="EMAIL_PORT"
            rules={[{ required: true, message: t('email.smtpPortRequired') }]}
          >
            <InputNumber
              disabled={isReadOnly}
              style={{ width: '100%' }}
              placeholder="465"
            />
          </Form.Item>
          <Form.Item
            label={t('email.useTlsSsl')}
            name="EMAIL_SECURE"
            valuePropName="checked"
          >
            <Switch disabled={isReadOnly} />
          </Form.Item>
          <Form.Item
            label={t('email.smtpUser')}
            name="EMAIL_USER"
            rules={[{ required: true, message: t('email.smtpUserRequired') }]}
          >
            <Input disabled={isReadOnly} placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            label={t('email.smtpPassword')}
            name="EMAIL_PASSWORD"
            rules={[
              { required: true, message: t('email.smtpPasswordRequired') },
            ]}
          >
            <Input.Password disabled={isReadOnly} placeholder="••••••••" />
          </Form.Item>
        </>
      );
    }
    if (provider === 'SENDGRID') {
      return (
        <Form.Item
          label={t('email.sendgridApiKey')}
          name="SENDGRID_API_KEY"
          rules={[
            { required: true, message: t('email.sendgridApiKeyRequired') },
          ]}
        >
          <Input.Password disabled={isReadOnly} placeholder="SG.xxxxx" />
        </Form.Item>
      );
    }
    if (provider === 'MAILGUN') {
      return (
        <>
          <Form.Item
            label={t('email.mailgunApiKey')}
            name="MAILGUN_API_KEY"
            rules={[
              { required: true, message: t('email.mailgunApiKeyRequired') },
            ]}
          >
            <Input.Password disabled={isReadOnly} placeholder="key-xxxxx" />
          </Form.Item>
          <Form.Item
            label={t('email.mailgunDomain')}
            name="MAILGUN_DOMAIN"
            rules={[
              { required: true, message: t('email.mailgunDomainRequired') },
            ]}
          >
            <Input disabled={isReadOnly} placeholder="mg.example.com" />
          </Form.Item>
        </>
      );
    }
    if (provider === 'RESEND') {
      return (
        <Form.Item
          label={t('email.resendApiKey')}
          name="RESEND_API_KEY"
          rules={[{ required: true, message: t('email.resendApiKeyRequired') }]}
        >
          <Input.Password disabled={isReadOnly} placeholder="re_xxxxx" />
        </Form.Item>
      );
    }
    if (provider === 'AWS_SES') {
      return (
        <>
          <Form.Item
            label={t('email.awsRegion')}
            name="AWS_REGION"
            rules={[{ required: true, message: t('email.awsRegionRequired') }]}
          >
            <Input disabled={isReadOnly} placeholder="us-east-1" />
          </Form.Item>
          <Form.Item
            label={t('email.awsAccessKeyId')}
            name="AWS_ACCESS_KEY_ID"
            rules={[
              { required: true, message: t('email.awsAccessKeyIdRequired') },
            ]}
          >
            <Input.Password disabled={isReadOnly} />
          </Form.Item>
          <Form.Item
            label={t('email.awsSecretAccessKey')}
            name="AWS_SECRET_ACCESS_KEY"
            rules={[
              {
                required: true,
                message: t('email.awsSecretAccessKeyRequired'),
              },
            ]}
          >
            <Input.Password disabled={isReadOnly} />
          </Form.Item>
        </>
      );
    }
    return null;
  };

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
        {t('email.configuration')}
      </h3>
      <Typography.Paragraph style={{ color: '#666', marginBottom: '16px' }}>
        {t('email.configDesc')}
      </Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('email.onlyOneProvider')}
      />

      <Form form={form} layout="vertical" disabled={isReadOnly}>
        <Form.Item
          label={t('email.provider')}
          name="EMAIL_PROVIDER"
          rules={[{ required: true, message: t('email.selectProvider') }]}
        >
          <Radio.Group
            onChange={onProviderChange}
            value={provider}
            size="large"
            buttonStyle="solid"
          >
            <Space size="small" wrap>
              {(Object.keys(PROVIDER_LABELS) as EmailProvider[]).map((p) => (
                <Radio.Button
                  key={p}
                  value={p}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    paddingInline: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      width: 22,
                      height: 22,
                      marginRight: 10,
                    }}
                  >
                    {PROVIDER_ICONS[p as EmailProvider]}
                  </span>
                  <span
                    style={{
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {PROVIDER_LABELS[p as EmailProvider]}
                  </span>
                </Radio.Button>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('email.fromEmail')}
          name="EMAIL_FROM"
          rules={[
            { required: true, message: t('email.fromEmailRequired') },
            { type: 'email', message: t('email.invalidEmail') },
          ]}
        >
          <Input placeholder="no-reply@example.com" />
        </Form.Item>

        <ProviderSpecificFields />

        <Form.Item
          label={t('email.adminEmail')}
          name="ADMIN_EMAIL"
          rules={[{ type: 'email', message: t('email.invalidEmail') }]}
        >
          <Input placeholder="admin@example.com" />
        </Form.Item>

        {!isReadOnly && (
          <Flex gap="small" style={{ marginTop: 16 }}>
            <Button type="primary" onClick={onSave} loading={isSaving}>
              {t('email.saveSettings')}
            </Button>
          </Flex>
        )}
      </Form>
    </div>
  );
};

export default EmailTab;

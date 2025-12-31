import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Flex, Input, Tabs, Typography } from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { normalizeEnvSettings } from '../../../../shared/utils';
import StripeProductsTab from './StripeProductsTab';

interface StripeTabProps {
  stripeSecretKey: string;
  onStripeSecretKeyChange: (value: string) => void;
  stripePublishedKey: string;
  onStripePublishedKeyChange: (value: string) => void;
  onStripeConfig: () => void;
  isSaving: boolean;
  isStripeConfigLoading: boolean;
  hasUnsavedChanges: boolean;
  isReadOnly?: boolean;
  documentId?: string;
  doc?: any;
  onClose?: () => void;
  onTriggerRedeployment?: () => void;
  environment?: 'preview' | 'production';
}

const StripeTab: React.FC<StripeTabProps> = ({
  stripeSecretKey,
  onStripeSecretKeyChange,
  stripePublishedKey,
  onStripePublishedKeyChange,
  onStripeConfig,
  isSaving,
  isStripeConfigLoading,
  hasUnsavedChanges,
  isReadOnly = false,
  documentId,
  doc,
  onClose,
  onTriggerRedeployment,
  environment = 'preview',
}) => {
  const { t } = useLanguage();

  // Get Stripe keys from current environment
  const envSettings = normalizeEnvSettings(doc?.meta?.envSettings, environment);
  let envStripeSecretKey = (envSettings.STRIPE_SECRET_KEY as string) || '';
  let envStripePublishedKey =
    (envSettings.STRIPE_PUBLISHABLE_KEY as string) || '';

  // If not found in envSettings, try to read from old structure (doc.meta.stripe)
  // This provides backward compatibility
  if (!envStripeSecretKey && !envStripePublishedKey && doc?.meta?.stripe) {
    const oldStripe = doc.meta.stripe as any;
    envStripeSecretKey = oldStripe.secretKey || '';
    envStripePublishedKey = oldStripe.publishedKey || '';
  }

  // Initialize editing state: if no keys exist, start in editing mode; if keys exist, start in view mode
  const [isEditing, setIsEditing] = useState(
    !envStripeSecretKey.trim() && !envStripePublishedKey.trim()
  );

  // Track previous loading state to detect when configuration completes
  const prevLoadingRef = useRef(false);

  // Update editing state when environment changes
  useEffect(() => {
    const hasKeys = envStripeSecretKey.trim() || envStripePublishedKey.trim();
    setIsEditing(!hasKeys);
  }, [environment, envStripeSecretKey, envStripePublishedKey]);

  // When configuration completes successfully, switch to view mode
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const isNowLoading = isSaving || isStripeConfigLoading;

    // If we were loading and now we're not, and there are no unsaved changes, switch to view mode
    if (
      wasLoading &&
      !isNowLoading &&
      !hasUnsavedChanges &&
      stripeSecretKey.trim()
    ) {
      setIsEditing(false);
    }

    prevLoadingRef.current = isNowLoading;
  }, [isSaving, isStripeConfigLoading, hasUnsavedChanges, stripeSecretKey]);
  const renderConfigurationContent = () => {
    if (isReadOnly) {
      return (
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
            {t('stripe.configuration')}
          </h3>

          <Typography.Paragraph style={{ color: '#666', marginBottom: '24px' }}>
            {t('stripe.readOnlyDesc')}
          </Typography.Paragraph>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
              }}
            >
              {t('stripe.secretKey')}
            </label>
            <Input.Password
              value={stripeSecretKey}
              readOnly
              style={{ width: '100%' }}
            />
            <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              {t('stripe.secretKeyDesc')}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
              }}
            >
              {t('stripe.publishedKey')}
            </label>
            <Input
              value={stripePublishedKey}
              readOnly
              style={{ width: '100%' }}
            />
            <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              {t('stripe.publishedKeyDesc')}
            </div>
          </div>

          <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            {t('stripe.noPermission')}
          </div>
        </div>
      );
    }

    // Show view mode by default if keys exist, otherwise show editing mode
    const hasKeys = stripeSecretKey.trim() || stripePublishedKey.trim();
    const shouldShowViewMode = hasKeys && !isEditing;

    if (shouldShowViewMode) {
      return (
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
            {t('stripe.configuration')}
          </h3>

          <Typography.Paragraph style={{ color: '#666', marginBottom: '24px' }}>
            {t('stripe.settingsDesc')}
          </Typography.Paragraph>

          <Alert
            message={t('stripe.settingsUpdated')}
            description={t('stripe.settingsUpdatedDesc')}
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />

          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              padding: 16,
              marginBottom: 20,
              backgroundColor: '#fafafa',
              maxWidth: 1000,
            }}
          >
            <Flex justify="space-between" align="start">
              <div style={{ flex: 1, paddingRight: 16 }}>
                {stripeSecretKey && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>{t('stripe.secretKey')}</strong>
                    <div style={{ wordBreak: 'break-word', marginTop: 4 }}>
                      {stripeSecretKey.substring(0, 8)}...
                      {stripeSecretKey.substring(stripeSecretKey.length - 4)}
                    </div>
                  </div>
                )}
                {stripePublishedKey && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>{t('stripe.publishedKey')}</strong>
                    <div style={{ wordBreak: 'break-word', marginTop: 4 }}>
                      {stripePublishedKey.substring(0, 8)}...
                      {stripePublishedKey.substring(
                        stripePublishedKey.length - 4
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="link"
                size="middle"
                onClick={() => setIsEditing(true)}
                style={{ marginTop: 4 }}
              >
                {t('common.edit')}
              </Button>
            </Flex>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
          {t('stripe.configuration')}
        </h3>

        <Typography.Paragraph style={{ color: '#666', marginBottom: '24px' }}>
          {t('stripe.configureDesc')}
        </Typography.Paragraph>

        <Alert
          message={t('stripe.settingsUpdated')}
          description={t('stripe.settingsUpdatedDesc')}
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
            }}
          >
            {t('stripe.secretKey')}
          </label>
          <Input.Password
            placeholder={t('stripe.secretKeyPlaceholder')}
            value={stripeSecretKey}
            onChange={(e) => {
              onStripeSecretKeyChange(e.target.value);
              setIsEditing(true);
            }}
            style={{ width: '100%' }}
          />
          <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            {t('stripe.secretKeyHelp')}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
            }}
          >
            {t('stripe.publishedKey')}
          </label>
          <Input
            placeholder={t('stripe.publishedKeyPlaceholder')}
            value={stripePublishedKey}
            onChange={(e) => {
              onStripePublishedKeyChange(e.target.value);
              setIsEditing(true);
            }}
            style={{ width: '100%' }}
          />
          <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            {t('stripe.publishedKeyHelp')}
          </div>
        </div>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #f0f0f0',
          }}
        >
          <Button
            type="primary"
            onClick={onStripeConfig}
            loading={isSaving || isStripeConfigLoading}
            disabled={!stripeSecretKey.trim() || !stripePublishedKey.trim()}
            style={{ marginRight: '12px' }}
          >
            {isSaving
              ? t('stripe.saving')
              : isStripeConfigLoading
                ? t('stripe.configuring')
                : t('stripe.saveKeys')}
          </Button>

          {hasKeys && (
            <Button
              onClick={() => setIsEditing(false)}
              style={{ marginRight: '12px' }}
            >
              {t('common.cancel')}
            </Button>
          )}

          {hasUnsavedChanges && (
            <span
              style={{
                color: '#faad14',
                fontSize: '12px',
                marginLeft: '8px',
              }}
            >
              {t('stripe.unsavedChanges')}
            </span>
          )}
        </div>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'configuration',
      label: 'Configuration',
      children: renderConfigurationContent(),
    },
    {
      key: 'products',
      label: 'Products',
      children: (
        <StripeProductsTab
          stripeSecretKey={stripeSecretKey}
          documentId={documentId || ''}
          isReadOnly={isReadOnly}
          doc={doc}
          onClose={onClose}
          onTriggerRedeployment={onTriggerRedeployment}
        />
      ),
    },
  ];

  return <Tabs defaultActiveKey="configuration" items={tabItems} />;
};

export default StripeTab;

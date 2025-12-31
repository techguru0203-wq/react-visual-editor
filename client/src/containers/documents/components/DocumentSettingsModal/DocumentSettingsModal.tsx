import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { DOCTYPE, SubscriptionTier } from '@prisma/client';
import { Button, Menu, message, Modal, Segmented, Tooltip } from 'antd';

import { useAppModal } from '../../../../common/components/AppModal';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url } from '../../../../lib/constants';
import {
  normalizeEnvSettings,
  toBaseVercelHost,
} from '../../../../shared/utils';
import trackEvent from '../../../../trackingClient';
import { setupStripeWebhookOnServer } from '../../../project/api/stripeApi';
import {
  getVercelProjectInfo,
  updateVercelEnvVars,
} from '../../../project/api/vercelApi';
import { TableInfo } from '../../../project/components/prototype/PrototypeDataBaseHandler';
import { updateDocumentSettings } from '../../api/documentSettingsApi';
import { AIModelTab } from './AIModelTab';
import { ConnectorsTab } from './ConnectorsTab';
import DatabaseTab from './DatabaseTab';
import DomainManagementContent from './DomainManagementContent';
import EmailTab from './EmailTab';
import FilesTab from './FilesTab';
import KnowledgeBaseTab from './KnowledgeBaseTab';
import ResetTab from './ResetTab';
import StripeTab from './StripeTab';
import { DocumentSettingsModalProps } from './types';
import UserManagementTab from './UserManagementTab';

const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({
  open,
  onClose,
  initialDoc,
  deployDocId,
  isReadOnly = false,
  isCustomDomainLocked,
  initialActiveTab,
  onTriggerRedeployment,
  onDocumentUpdated,
}) => {
  const { t } = useLanguage();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isStripeConfigLoading, setIsStripeConfigLoading] = useState(false);
  const [isDomainModalVisible, setIsDomainModalVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Doc state to manage updates
  const [doc, setDoc] = useState(initialDoc);

  // Sync doc with prop initialDoc when it changes
  useEffect(() => {
    setDoc(initialDoc);
  }, [initialDoc]);

  // Environment selector state (Preview/Production) for PRODUCT documents
  const [currentEnvironment, setCurrentEnvironment] = useState<
    'preview' | 'production'
  >('preview');

  // Local state for component management
  const [activeTab, setActiveTab] = useState(() => {
    // Use initialActiveTab if provided, otherwise default to 'database' for PRODUCT documents, 'domain' for others
    return (
      initialActiveTab ||
      (doc?.type === DOCTYPE.PRODUCT ? 'database' : 'domain')
    );
  });
  const [isViewingDatabase, setIsViewingDatabase] = useState(false);
  const [localStripeSecretKey, setLocalStripeSecretKey] = useState('');
  const [localStripePublishedKey, setLocalStripePublishedKey] = useState('');

  // Callback to update doc meta (merge instead of replace to preserve other fields)
  const handleDocMetaUpdate = useCallback((updatedMeta: any) => {
    setDoc((prevDoc: any) => ({
      ...prevDoc,
      meta: {
        ...(prevDoc?.meta || {}),
        ...updatedMeta,
      },
    }));
  }, []);

  // Get environment-specific Stripe keys
  const envSettings = useMemo(() => {
    return normalizeEnvSettings(doc?.meta?.envSettings, currentEnvironment);
  }, [doc?.meta?.envSettings, currentEnvironment]);

  // Update activeTab when modal opens with initialActiveTab
  useEffect(() => {
    if (open && initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [open, initialActiveTab]);

  // Reset tables when environment changes
  useEffect(() => {
    setTables([]);
  }, [currentEnvironment]);

  const handleCancel = () => {
    if (activeTab === 'stripe' && hasUnsavedChanges) {
      if (window.confirm(t('settings.unsavedChanges'))) {
        setHasUnsavedChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // App modal hook for Stripe configuration
  const { showAppModal } = useAppModal();
  const { user, subscriptionTier } = useCurrentUser();

  // Check if user has access to Knowledge Base (requires PRO tier or above)
  const canAccessKnowledgeBase =
    subscriptionTier === SubscriptionTier.PRO ||
    subscriptionTier === SubscriptionTier.BUSINESS ||
    subscriptionTier === SubscriptionTier.ENTERPRISE;

  const onShowUpgradeModal = () => {
    showAppModal({
      type: 'updateSubscription',
      payload: {
        email: user.email,
        source: 'domainManagement',
        destination: 'customDomain',
      },
    });
  };

  // Local functions for component management
  const onTabChange = (tab: string) => {
    // Check if user is trying to access Knowledge Base without permission
    if (tab === 'knowledgeBase' && !canAccessKnowledgeBase) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'documentSettingsModal',
          destination: 'knowledgeBase',
        },
      });
      return;
    }
    setActiveTab(tab);
  };

  const onConnectDomain = () => setIsDomainModalVisible(true);

  const [tables, setTables] = useState<TableInfo[]>([]);

  const onSaveDatabaseSettings = async (settings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  }) => {
    try {
      // Get current envSettings from document meta
      const allEnvSettings = (doc?.meta?.envSettings as any) || {};

      // Check if using new structure
      const isNewStructure =
        allEnvSettings.preview || allEnvSettings.production;

      let updatedEnvSettings: any;
      if (isNewStructure) {
        // New structure: update only current environment
        updatedEnvSettings = {
          ...allEnvSettings,
          [currentEnvironment]: {
            ...(allEnvSettings[currentEnvironment] || {}),
            DATABASE_URL: settings.DATABASE_URL,
            JWT_SECRET: settings.JWT_SECRET,
          },
        };
      } else {
        // Old structure or first time: create new structure
        const currentSettings = {
          ...allEnvSettings,
          DATABASE_URL: settings.DATABASE_URL,
          JWT_SECRET: settings.JWT_SECRET,
        };

        // Save to current environment only
        if (currentEnvironment === 'preview') {
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

      // Save database settings to document metadata using envSettings
      const result = await updateDocumentSettings(doc?.id || '', {
        envSettings: updatedEnvSettings,
      });

      if (result.success) {
        // Use server-returned document to ensure all fields (including previewUpdatedAt) are up-to-date
        const updatedDoc = result.data?.document;
        if (updatedDoc) {
          setDoc(updatedDoc);
          // Notify parent component to update its copy
          if (onDocumentUpdated) {
            onDocumentUpdated(updatedDoc);
          }
        }
        message.success(t('message.databaseSaved'));
      } else {
        message.error(result.errorMsg || t('message.databaseSaveFailed'));
      }
    } catch (error) {
      message.error(t('message.databaseSaveFailed') + ': ' + error);
    }
  };

  // Track changes to Stripe keys
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [open]);

  // Sync local state with environment-specific Stripe keys when environment or document changes
  useEffect(() => {
    // Try to read from new structure first (envSettings)
    let stripeSecretKey = (envSettings.STRIPE_SECRET_KEY as string) || '';
    let stripePublishedKey =
      (envSettings.STRIPE_PUBLISHABLE_KEY as string) || '';

    // If not found in envSettings, try to read from old structure (doc.meta.stripe)
    // This provides backward compatibility
    if (!stripeSecretKey && !stripePublishedKey && doc?.meta?.stripe) {
      const oldStripe = doc.meta.stripe as any;
      stripeSecretKey = oldStripe.secretKey || '';
      stripePublishedKey = oldStripe.publishedKey || '';
    }

    setLocalStripeSecretKey(stripeSecretKey);
    setLocalStripePublishedKey(stripePublishedKey);
  }, [envSettings, currentEnvironment, doc?.meta?.stripe]);

  // Load database settings from document metadata when component mounts
  useEffect(() => {
    if (doc?.meta?.database) {
      const dbMeta = doc.meta.database as any;
      // Update the document metadata to include database settings
      if (dbMeta.url || dbMeta.jwt) {
        // This will trigger the DatabaseTab to re-render with the correct settings
        console.log('Loaded database settings from metadata:', dbMeta);
      }
    }
  }, [doc?.meta?.database]);

  const handleStripeSecretKeyChange = (value: string) => {
    setLocalStripeSecretKey(value);
    setHasUnsavedChanges(true);
  };

  const handleStripePublishedKeyChange = (value: string) => {
    setLocalStripePublishedKey(value);
    setHasUnsavedChanges(true);
  };

  const handleSaveStripeToDB = async (closeModal: boolean = true) => {
    if (!doc?.id) {
      message.error(t('message.documentIdRequired'));
      return false;
    }

    setIsSaving(true);
    try {
      // Get current envSettings from document meta
      const allEnvSettings = (doc?.meta?.envSettings as any) || {};

      // Check if using new structure (environment-based)
      const isNewStructure =
        allEnvSettings.preview || allEnvSettings.production;

      let updatedEnvSettings: any;

      if (isNewStructure) {
        // New structure: update only current environment
        updatedEnvSettings = {
          ...allEnvSettings,
          [currentEnvironment]: {
            ...(allEnvSettings[currentEnvironment] || {}),
            STRIPE_SECRET_KEY: localStripeSecretKey,
            STRIPE_PUBLISHABLE_KEY: localStripePublishedKey,
          },
        };
      } else {
        // Old structure or first time: create new structure
        const currentSettings = {
          ...allEnvSettings,
          STRIPE_SECRET_KEY: localStripeSecretKey,
          STRIPE_PUBLISHABLE_KEY: localStripePublishedKey,
        };

        // Save to current environment only
        if (currentEnvironment === 'preview') {
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

      const result = await updateDocumentSettings(doc.id, {
        envSettings: updatedEnvSettings,
      });

      if (result.success) {
        // Use server-returned document to ensure all fields are up-to-date
        const updatedDoc = result.data?.document;
        if (updatedDoc) {
          setDoc(updatedDoc);
          // Notify parent component to update its copy
          if (onDocumentUpdated) {
            onDocumentUpdated(updatedDoc);
          }
        }
        setHasUnsavedChanges(false);
        message.success(t('message.stripeSaveSuccess'));
        if (closeModal) {
          onClose();
        }
        return true;
      } else {
        message.error(result.errorMsg || t('message.stripeSaveFailed'));
        return false;
      }
    } catch (error) {
      console.error('Error saving Stripe settings:', error);
      message.error(t('message.stripeError'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    let docType = doc?.type.toLowerCase();
    if (!doc?.id) {
      message.error(t('message.appIdRequired').replace('{docType}', docType));
      return;
    }

    Modal.confirm({
      title: t('reset.title'),
      content: t('reset.warningDesc'),
      okText: t('reset.resetApp'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      centered: true,
      onOk: async () => {
        if (!doc?.id) {
          message.error(
            t('message.appIdRequired').replace('{docType}', docType)
          );
          return;
        }
        // track event
        trackEvent('resetApp', {
          distinct_id: user.email,
          payload: JSON.stringify({
            documentId: doc.id,
            docType: doc.type,
          }),
        });
        setIsResetting(true);
        try {
          const headers = await getHeaders();
          const response = await fetch(
            `${api_url}/api/documents/${doc.id}/reset`,
            {
              method: 'POST',
              headers,
            }
          );

          const result = await response.json();

          if (result.success) {
            message.success(
              t('message.resetSuccess').replace('{docType}', docType)
            );
            onClose();
            // Reload the page to ensure all state is fresh
            setTimeout(() => {
              window.location.reload();
            }, 2500);
          } else {
            message.error(
              result.errorMsg ||
                t('message.resetFailed').replace('{docType}', docType)
            );
          }
        } catch (error) {
          console.error('Error resetting document:', error);
          message.error(t('message.resetError').replace('{docType}', docType));
        } finally {
          setIsResetting(false);
        }
      },
    });
  };

  const handleStripeConfig = async () => {
    if (!doc?.id || !doc?.type) {
      message.error(t('message.documentInfoRequired'));
      return;
    }

    // track event
    trackEvent('stripePaymentSetup', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: doc.id,
        docType: doc.type,
      }),
    });
    // First save the current Stripe keys (without closing the modal)
    const saveSuccess = await handleSaveStripeToDB(false);
    if (!saveSuccess) {
      return; // Stop if save failed
    }

    setIsStripeConfigLoading(true);

    try {
      // Select URL based on current environment
      const targetUrl =
        currentEnvironment === 'production'
          ? (doc?.meta?.publishUrl as string)
          : (doc?.meta?.sourceUrl as string);

      if (!targetUrl) {
        message.error(
          currentEnvironment === 'production'
            ? t('message.productionNotDeployed')
            : t('message.generateFirst')
        );
        return;
      }

      console.log('targetUrl:', targetUrl);
      // Get base vercel host
      const baseUserDomain = toBaseVercelHost(targetUrl);

      const projectInfo = await getVercelProjectInfo(deployDocId || '');
      // Check if projectInfo is valid
      if (!projectInfo || !projectInfo.id) {
        console.error(t('message.projectNotFound'));
        return;
      }

      // Setup Stripe webhook
      const result = await setupStripeWebhookOnServer({
        secretKey: localStripeSecretKey,
        userDomain: baseUserDomain,
      });

      console.log('Stripe webhook setup result:', result);
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to setup Stripe webhook');
      }

      const createdNew = Boolean(result.signingSecret);
      if (createdNew && result.signingSecret) {
        await updateVercelEnvVars(deployDocId || '', [
          {
            key: 'STRIPE_SECRET_KEY',
            value: localStripeSecretKey,
            target: [currentEnvironment],
          },
          {
            key: 'VITE_STRIPE_PUBLISHABLE_KEY',
            value: localStripePublishedKey,
            target: [currentEnvironment],
          },
          {
            key: 'STRIPE_WEBHOOK_SECRET',
            value: result.signingSecret,
            target: [currentEnvironment],
          },
          {
            key: 'FRONTEND_URL',
            value: baseUserDomain,
            target: [currentEnvironment],
          },
        ]);
      }

      // Don't close modal automatically - let user review the configuration and close manually
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        console.error(t('message.projectNotFound'));
      } else if (
        error.message?.includes('maximum of 16 test webhook endpoints.')
      ) {
        message.error(t('message.maxWebhooks'));
      } else {
        console.error(t('message.vercelUpdateFailed'), error);
        message.error(t('message.stripeKeysFailed'));
      }
    } finally {
      setIsStripeConfigLoading(false);
    }
  };

  // Determine menu items based on document type
  const getMenuItems = () => {
    const isPrototype = doc?.type === 'PROTOTYPE';
    const isProduct = doc?.type === 'PRODUCT';

    if (isPrototype) {
      return [
        {
          key: 'domain',
          label: t('settings.domain'),
        },
        {
          key: 'reset',
          label: t('settings.resetApp'),
        },
      ];
    }

    if (isProduct) {
      return [
        {
          key: 'database',
          label: t('settings.database'),
        },
        {
          key: 'users',
          label: t('settings.users'),
        },
        {
          key: 'stripe',
          label: t('settings.payment'),
        },
        {
          key: 'aiModel',
          label: t('settings.aiModel'),
        },
        {
          key: 'connectors',
          label: t('connectors.title'),
        },
        {
          key: 'email',
          label: t('settings.email'),
        },
        {
          key: 'files',
          label: t('settings.files'),
        },
        {
          key: 'knowledgeBase',
          label: (
            <Tooltip
              title={
                canAccessKnowledgeBase
                  ? t('settings.knowledgeBase')
                  : t('nav.upgradePlanToAccessKnowledgeBase')
              }
            >
              <span
                style={{
                  color: canAccessKnowledgeBase ? undefined : '#ccc',
                  cursor: 'pointer',
                }}
              >
                {t('settings.knowledgeBase')}
              </span>
            </Tooltip>
          ),
        },
        {
          key: 'domain',
          label: t('settings.domain'),
        },
        {
          key: 'reset',
          label: t('settings.resetApp'),
        },
      ];
    }

    return [
      {
        key: 'domain',
        label: t('settings.domain'),
      },
      {
        key: 'reset',
        label: t('settings.resetApp'),
      },
    ];
  };

  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              type="text"
              icon={
                isSidebarCollapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{
                fontSize: '16px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <span>
              {doc?.type === DOCTYPE.PROTOTYPE
                ? t('settings.prototypeTitle')
                : t('settings.productTitle')}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '-8px -12px 0 0',
            }}
          >
            {/* Environment selector for PRODUCT documents */}
            {doc?.type === DOCTYPE.PRODUCT && (
              <Segmented
                value={currentEnvironment}
                onChange={(value) =>
                  setCurrentEnvironment(value as 'preview' | 'production')
                }
                options={[
                  {
                    label: t('settings.environment.preview'),
                    value: 'preview',
                  },
                  {
                    label: t('settings.environment.production'),
                    value: 'production',
                  },
                ]}
                style={{ marginRight: '8px' }}
              />
            )}
            <Button
              type="text"
              icon={
                isFullScreen ? (
                  <FullscreenExitOutlined />
                ) : (
                  <FullscreenOutlined />
                )
              }
              onClick={() => setIsFullScreen(!isFullScreen)}
              style={{
                fontSize: '16px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={handleCancel}
              style={{
                fontSize: '16px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </div>
        </div>
      }
      open={open}
      onOk={activeTab === 'stripe' ? () => handleSaveStripeToDB() : undefined}
      onCancel={() => {
        if (activeTab === 'stripe' && hasUnsavedChanges) {
          if (window.confirm(t('settings.unsavedChanges'))) {
            setHasUnsavedChanges(false);
            onClose();
          }
        } else {
          onClose();
        }
      }}
      okText={activeTab === 'stripe' ? t('settings.saveAll') : undefined}
      cancelText={t('settings.cancel')}
      width={isFullScreen ? '100%' : '75%'}
      style={
        isFullScreen ? { top: 0, maxWidth: '100vw', padding: 0 } : { top: 0 }
      }
      centered={!isFullScreen}
      confirmLoading={isSaving}
      closeIcon={null}
    >
      <div
        style={{
          display: 'flex',
          height: isFullScreen ? 'calc(100vh - 110px)' : '500px',
        }}
      >
        {/* Left Sidebar */}
        {!isSidebarCollapsed && (
          <div
            style={{
              width: '180px',
              borderRight: '1px solid #f0f0f0',
              paddingRight: '12px',
              marginRight: '12px',
              transition: 'all 0.3s',
            }}
          >
            <Menu
              mode="vertical"
              selectedKeys={[activeTab]}
              onClick={(e) => onTabChange(e.key)}
              style={{ border: 'none' }}
              items={getMenuItems()}
            />
          </div>
        )}

        {/* Right Content Panel */}
        <div
          style={{
            flex: 1,
            paddingLeft: isSidebarCollapsed ? '0' : '16px',
            overflow: 'auto',
            maxHeight: '100%',
            transition: 'all 0.3s',
          }}
        >
          {activeTab === 'database' && (
            <DatabaseTab
              documentId={doc?.id}
              doc={doc}
              databaseSettings={{
                DATABASE_URL: doc?.meta?.database?.url as string,
                JWT_SECRET: doc?.meta?.database?.jwt as string,
              }}
              onSaveDatabaseSettings={onSaveDatabaseSettings}
              tables={tables}
              setTables={setTables}
              isReadOnly={isReadOnly}
              environment={currentEnvironment}
            />
          )}

          {activeTab === 'files' && (
            <FilesTab documentId={doc?.id} isReadOnly={isReadOnly} />
          )}

          {activeTab === 'users' && (
            <UserManagementTab
              documentId={doc?.id}
              isReadOnly={isReadOnly}
              environment={currentEnvironment}
              doc={doc}
            />
          )}

          {activeTab === 'stripe' && (
            <StripeTab
              stripeSecretKey={localStripeSecretKey}
              onStripeSecretKeyChange={handleStripeSecretKeyChange}
              stripePublishedKey={localStripePublishedKey}
              onStripePublishedKeyChange={handleStripePublishedKeyChange}
              onStripeConfig={handleStripeConfig}
              isSaving={isSaving}
              isStripeConfigLoading={isStripeConfigLoading}
              hasUnsavedChanges={hasUnsavedChanges}
              isReadOnly={isReadOnly}
              documentId={doc?.id}
              doc={doc}
              onClose={onClose}
              onTriggerRedeployment={onTriggerRedeployment}
              environment={currentEnvironment}
            />
          )}

          {activeTab === 'aiModel' && (
            <AIModelTab
              documentId={doc?.id}
              doc={doc}
              isReadOnly={isReadOnly}
              onClose={onClose}
              onTriggerRedeployment={onTriggerRedeployment}
              environment={currentEnvironment}
            />
          )}

          {activeTab === 'knowledgeBase' && (
            <KnowledgeBaseTab
              documentId={doc?.id}
              doc={doc}
              isReadOnly={isReadOnly}
              environment={currentEnvironment}
              deployDocId={deployDocId}
              onDocMetaUpdate={handleDocMetaUpdate}
            />
          )}

          {activeTab === 'connectors' && (
            <ConnectorsTab
              documentId={doc?.id}
              doc={doc}
              environment={currentEnvironment}
            />
          )}

          {activeTab === 'email' && (
            <EmailTab
              documentId={doc?.id}
              doc={doc}
              deployDocId={deployDocId}
              isReadOnly={isReadOnly}
              environment={currentEnvironment}
              onDocMetaUpdate={handleDocMetaUpdate}
            />
          )}

          {activeTab === 'domain' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
                {t('settings.domain')} {t('common.configuration')}
                {isCustomDomainLocked && (
                  <Tooltip title={t('message.domainUpgrade')}>
                    <InfoCircleOutlined
                      style={{
                        color: 'orange',
                        marginLeft: '8px',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        onShowUpgradeModal?.();
                        onClose();
                      }}
                    />
                  </Tooltip>
                )}
              </h3>

              {!isCustomDomainLocked ? (
                <DomainManagementContent deployDocId={deployDocId || ''} />
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ marginBottom: '16px', color: '#666' }}>
                    {t('message.domainConnectDesc')}
                  </p>
                  <Button
                    type="primary"
                    disabled={isCustomDomainLocked}
                    onClick={() => {
                      if (isCustomDomainLocked) {
                        onShowUpgradeModal?.();
                      } else {
                        onConnectDomain?.();
                      }
                      onClose();
                    }}
                    style={{ marginBottom: '16px' }}
                  >
                    {t('message.connectDomain')}
                  </Button>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {t('message.domainUpgradeDesc')}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reset' && (
            <ResetTab
              onReset={handleReset}
              isResetting={isResetting}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DocumentSettingsModal;

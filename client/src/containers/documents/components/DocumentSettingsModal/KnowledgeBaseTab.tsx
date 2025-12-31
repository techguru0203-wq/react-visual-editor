import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  InputNumber,
  message,
  Space,
  Spin,
  Tooltip,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../common/contexts/languageContext';
import {
  getKnowledgeBaseList,
  KnowledgeBase,
  KnowledgeBaseConfig,
} from '../../../../common/api/knowledgeBaseApi';
import { updateDocumentSettings } from '../../api/documentSettingsApi';
import { updateVercelEnvVars } from '../../../project/api/vercelApi';

interface KnowledgeBaseTabProps {
  documentId?: string;
  doc?: any;
  isReadOnly?: boolean;
  environment: 'preview' | 'production';
  deployDocId?: string;
  onDocMetaUpdate?: (updatedMeta: any) => void;
}

interface SelectedKnowledgeBase extends KnowledgeBaseConfig {}

const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
  documentId,
  doc,
  isReadOnly = false,
  environment,
  deployDocId,
  onDocMetaUpdate,
}) => {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [selectedKBs, setSelectedKBs] = useState<SelectedKnowledgeBase[]>([]);
  const [initialKBs, setInitialKBs] = useState<SelectedKnowledgeBase[]>([]);

  // Load knowledge bases using react-query
  const {
    data: knowledgeBases = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['knowledgeBases'],
    queryFn: getKnowledgeBaseList,
  });

  // Show error message if query fails
  useEffect(() => {
    if (error) {
      message.error(t('knowledgeBase.saveFailed'));
      console.error('Error loading knowledge bases:', error);
    }
  }, [error, t]);

  // Load saved configuration from document meta based on environment
  useEffect(() => {
    // Try to read from new structure first (envSettings with environment separation)
    const envSettings = doc?.meta?.envSettings;
    let knowledgeBases: KnowledgeBaseConfig[] | undefined;

    if (envSettings) {
      const isNewStructure = envSettings.preview || envSettings.production;
      if (isNewStructure) {
        // New structure: read from current environment
        const currentEnvSettings = envSettings[environment];
        if (currentEnvSettings?.knowledgeBaseSettings?.knowledgeBases) {
          knowledgeBases =
            currentEnvSettings.knowledgeBaseSettings.knowledgeBases;
        }
      }
    }

    // Fallback: try old structure (backward compatibility)
    if (!knowledgeBases && doc?.meta?.knowledgeBaseSettings?.knowledgeBases) {
      knowledgeBases = doc.meta.knowledgeBaseSettings.knowledgeBases;
    }

    // Set selected KBs and initial KBs
    const kbs =
      knowledgeBases && Array.isArray(knowledgeBases)
        ? knowledgeBases.map((kb: KnowledgeBaseConfig) => ({ ...kb }))
        : [];

    setSelectedKBs(kbs);
    setInitialKBs(kbs);
  }, [doc?.meta?.envSettings, doc?.meta?.knowledgeBaseSettings, environment]);

  const handleKBToggle = useCallback((kb: KnowledgeBase, checked: boolean) => {
    if (checked) {
      setSelectedKBs((prev) => [
        ...prev,
        {
          id: kb.id,
          name: kb.name,
          weight: 5, // Default weight
        },
      ]);
    } else {
      setSelectedKBs((prev) => prev.filter((item) => item.id !== kb.id));
    }
  }, []);

  const handleWeightChange = useCallback(
    (kbId: string, weight: number | null) => {
      if (weight !== null && weight >= 1 && weight <= 10) {
        setSelectedKBs((prev) =>
          prev.map((kb) => (kb.id === kbId ? { ...kb, weight } : kb))
        );
      }
    },
    []
  );

  // Check if configuration has changed
  const hasChanges = () => {
    if (selectedKBs.length !== initialKBs.length) return true;

    // Sort both arrays by id for comparison
    const sortedSelected = [...selectedKBs].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
    const sortedInitial = [...initialKBs].sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    return sortedSelected.some((kb, idx) => {
      const initialKb = sortedInitial[idx];
      return kb.id !== initialKb.id || kb.weight !== initialKb.weight;
    });
  };

  const handleSave = async () => {
    if (!documentId) {
      message.error(t('knowledgeBase.saveFailed'));
      return;
    }

    setSaving(true);
    try {
      // Prepare knowledge base settings for current environment
      const knowledgeBaseSettings = {
        knowledgeBases: selectedKBs.map(({ id, name, weight }) => ({
          id,
          name,
          weight,
        })),
      };

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
          [environment]: {
            ...(allEnvSettings[environment] || {}),
            knowledgeBaseSettings,
          },
        };
      } else {
        // Old structure or first time: create new structure
        const currentSettings = {
          ...allEnvSettings,
          knowledgeBaseSettings,
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

      // Save to document meta using envSettings
      const result = await updateDocumentSettings(documentId, {
        envSettings: updatedEnvSettings,
      });

      if (!result.success) {
        message.error(result.errorMsg || t('knowledgeBase.saveFailed'));
        return;
      }

      if (onDocMetaUpdate) {
        const updatedMeta = {
          ...(doc?.meta || {}),
          envSettings: updatedEnvSettings,
        };
        onDocMetaUpdate(updatedMeta);
      }

      // Update initial state after successful save
      setInitialKBs(selectedKBs.map((kb) => ({ ...kb })));

      // Update Vercel environment variables
      const kbConfig = {
        knowledgeBases: knowledgeBaseSettings.knowledgeBases.map((kb) => ({
          id: kb.id,
          weight: kb.weight,
        })),
      };

      if (deployDocId) {
        await updateVercelEnvVars(deployDocId, [
          {
            key: 'KNOWLEDGE_BASE_CONFIG',
            value: JSON.stringify(kbConfig),
            target: [environment],
          },
        ]);
      } else {
        console.warn(
          'KnowledgeBaseTab: deployDocId is missing, skipping Vercel env update.'
        );
      }

      message.success(t('knowledgeBase.saveSuccess'));
    } catch (error) {
      console.error('Error saving knowledge base settings:', error);
      message.error(t('knowledgeBase.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px' }}>{t('knowledgeBase.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>
        {t('knowledgeBase.title')}
      </h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        {t('knowledgeBase.setting.description')}
      </p>

      {knowledgeBases.length === 0 ? (
        <Empty description={t('knowledgeBase.noKnowledgeBases')} />
      ) : (
        <>
          {/* Knowledge Base Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {knowledgeBases.map((kb) => {
              const isSelected = selectedKBs.some((item) => item.id === kb.id);
              const selectedKB = selectedKBs.find((item) => item.id === kb.id);

              return (
                <Card
                  key={kb.id}
                  size="small"
                  hoverable
                  style={{
                    height: '100%',
                    border: isSelected
                      ? '2px solid #1890ff'
                      : '1px solid #d9d9d9',
                    backgroundColor: isSelected ? '#f0f7ff' : '#fff',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onClick={() => !isReadOnly && handleKBToggle(kb, !isSelected)}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleKBToggle(kb, e.target.checked)}
                    />
                  </div>

                  {/* Card content */}
                  <div style={{ paddingRight: '48px' }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={kb.name}
                    >
                      {kb.name}
                    </div>

                    <p
                      style={{
                        margin: '0 0 8px 0',
                        color: '#666',
                        fontSize: '12px',
                        minHeight: '36px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={kb.description || t('knowledgeBase.noDescription')}
                    >
                      {kb.description || t('knowledgeBase.noDescription')}
                    </p>

                    <Space
                      size="small"
                      style={{
                        fontSize: '11px',
                        color: '#999',
                        marginBottom: '8px',
                      }}
                    >
                      <span>
                        {t('knowledgeBase.fileCount', {
                          count: kb._count?.files || 0,
                        })}
                      </span>
                      <span>•</span>
                      <span>{formatDate(kb.updatedAt)}</span>
                    </Space>

                    {/* Weight controls - only show when selected */}
                    {isSelected && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e8e8e8',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <label
                            style={{
                              marginBottom: 0,
                              fontSize: '12px',
                              minWidth: '45px',
                            }}
                          >
                            {t('knowledgeBase.weight')}:
                            <Tooltip title={t('knowledgeBase.weightDesc')}>
                              <InfoCircleOutlined
                                style={{ marginLeft: '4px', color: '#999' }}
                              />
                            </Tooltip>
                          </label>
                          <InputNumber
                            min={1}
                            max={10}
                            value={selectedKB?.weight || 5}
                            onChange={(value) =>
                              handleWeightChange(kb.id, value)
                            }
                            disabled={isReadOnly}
                            size="small"
                            style={{ width: '60px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Save button */}
          {!isReadOnly && (
            <div style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges()}
              >
                {t('knowledgeBase.save')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default KnowledgeBaseTab;

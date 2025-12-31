import { useCallback, useEffect, useMemo, useState } from 'react';
import { InfoCircleOutlined, UndoOutlined } from '@ant-design/icons';
import { Document, Prisma } from '@prisma/client';
import {
  Drawer,
  Flex,
  List,
  message,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { getFormHeaders } from '../../../common/util/apiHeaders';
import { isFeatureLocked } from '../../../common/util/app';
import { api_url, COLORS } from '../../../lib/constants';
import { upsertDocument } from '../../project/api/document';
import { DocHistoryItem } from './DocumentEditor';
import FeedbackRating from './FeedbackRating';
import {
  getDocumentHistoryApi,
  DocumentHistoryItem,
} from '../api/documentHistoryApi';
import { useQuery } from '@tanstack/react-query';

import './DocumentHistory.scss';

type DocumentHistoryProps = Readonly<{
  document: Partial<Document>;
  onRefetchDocument?: () => void;
  onHandleHistoryChange: (
    item: DocHistoryItem,
    versionNumber: number
  ) => Promise<void>;
  isHistoryOpen?: boolean; // External control for history drawer
  onHistoryOpenChange?: (open: boolean) => void; // Callback when history state changes
}>;

export default function DocumentHistory({
  document,
  onRefetchDocument,
  onHandleHistoryChange,
  isHistoryOpen: externalIsHistoryOpen,
  onHistoryOpenChange,
}: DocumentHistoryProps) {
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const [internalIsHistoryOpen, setInternalIsHistoryOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isHistoryOpen =
    externalIsHistoryOpen !== undefined
      ? externalIsHistoryOpen
      : internalIsHistoryOpen;
  const setIsHistoryOpen = (open: boolean) => {
    if (onHistoryOpenChange) {
      onHistoryOpenChange(open);
    } else {
      setInternalIsHistoryOpen(open);
    }
  };
  const [selectedDoc, setSelectedDoc] = useState<DocHistoryItem | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [tempSelectedVersion, setTempSelectedVersion] = useState<number | null>(
    null
  );
  const [previewHistoryItem, setPreviewHistoryItem] =
    useState<DocHistoryItem | null>(null);
  const isDocHistoryLocked = isFeatureLocked(
    subscriptionStatus,
    subscriptionTier
  );

  // Create a stable reference to the parsed history for dependency tracking
  const activeHistoryVersion = useMemo(() => {
    if (document?.meta && typeof document.meta === 'object') {
      const meta = document.meta as any;
      return meta.activeHistoryVersion || '';
    }
    return '';
  }, [document?.meta]);

  // Clear temporary selection and preview when document meta changes (e.g., after restore)
  useEffect(() => {
    setTempSelectedVersion(null);
  }, [document?.meta]);

  // Clear pointer when document meta history changes (e.g., after restore)
  useEffect(() => {
    setPreviewHistoryItem(null);
  }, [activeHistoryVersion]);

  // Fetch document history from the new DocumentHistory table
  const {
    data: documentHistories,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['documentHistory', document.id],
    queryFn: () =>
      document.id ? getDocumentHistoryApi(document.id) : Promise.resolve([]),
    enabled: !!document.id && isHistoryOpen,
  });

  // Convert DocumentHistoryItem to DocHistoryItem format for backward compatibility
  const docHistory: DocHistoryItem[] = useMemo(() => {
    if (!documentHistories) return [];

    return documentHistories.map((item: DocumentHistoryItem) => ({
      id: item.id,
      versionNumber: item.versionNumber,
      content: item.content || undefined,
      fileUrl: item.fileUrl || undefined,
      description: item.description,
      date: item.createdAt, // Map createdAt to date for backward compatibility
      createdAt: item.createdAt,
      email: item.creatorEmail,
      userId: item.creatorUserId,
      creatorEmail: item.creatorEmail,
      creatorUserId: item.creatorUserId,
      currentVersionUrl: item.currentVersionUrl || '',
      rating: item.rating,
      chosenDocumentIds: item.chosenDocumentIds || undefined,
    }));
  }, [documentHistories]);

  const restoreVersion = useCallback(
    async (item: DocHistoryItem, versionNumber: number) => {
      setIsRestoring(true);
      setSelectedDoc(item);
      try {
        if (item.fileUrl) {
          // console.log(item.fileUrl);
          const prefix = 'source-code/';
          const index = item.fileUrl.indexOf(prefix);
          const key = index !== -1 ? item.fileUrl.substring(index) : '';
          const headers = await getFormHeaders();

          const res = await fetch(
            `${api_url}/api/s3FileService/fetch-code?key=${key}`,
            {
              method: 'GET',
              headers: headers,
              credentials: 'include',
              cache: 'reload',
            }
          );
          const result = await res.json();

          if (result.success) {
            // Format content as JSON with files array for localDoc update
            const filesArray = result.data.files.map((file: any) => ({
              path: file.path,
              content: file.content,
            }));

            const contentsJson = JSON.stringify({ files: filesArray });

            console.log('Formatted content from S3 files:', {
              fileCount: result.data.files.length,
              contentLength: contentsJson.length,
              contentPreview: contentsJson.substring(0, 200) + '...',
            });

            // Update the database with the JSON formatted content, sourceUrl and activeHistoryVersion
            try {
              // Get existing meta data
              const existingMeta = (document?.meta as Prisma.JsonObject) || {};

              await upsertDocument({
                id: document.id,
                contentStr: contentsJson,
                meta: {
                  ...existingMeta,
                  sourceUrl: item.currentVersionUrl,
                  activeHistoryVersion: versionNumber,
                },
              } as any);
              console.log('Successfully updated document content.');

              // Trigger refetch to update the UI
              if (onRefetchDocument) {
                onRefetchDocument();
              }

              // Clear preview state and temporary selection when version is restored
              setPreviewHistoryItem(null);
              setTempSelectedVersion(null); // Clear temporary selection to align highlight with restored version
            } catch (error) {
              console.error(
                'Error updating document content in database:',
                error
              );
            }
          } else {
            message.error(t('document.errorFetchingHistory'));
          }
        }
      } catch (error) {
        console.error('Error fetching history versions:', error);
        message.error(t('document.errorFetchingHistory'));
      } finally {
        setIsRestoring(false);
      }
    },
    [document, onRefetchDocument]
  );

  const onSelectDoc = async (item: DocHistoryItem, versionNumber: number) => {
    setIsSelecting(true);
    setSelectedDoc(item);
    setTempSelectedVersion(versionNumber); // Set temporary selection
    try {
      await onHandleHistoryChange(item, versionNumber);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <>
      <Drawer
        title={t('document.documentHistory')}
        placement="left"
        onClose={() => {
          setIsHistoryOpen(false);
        }}
        open={isHistoryOpen}
        className="app-drawer"
      >
        <Flex vertical style={{ position: 'relative', minHeight: '400px' }}>
          {/* Overlay spinner that shows in the middle of visible area */}
          {(isRestoring || isSelecting || isLoadingHistory) && (
            <div
              style={{
                position: 'fixed',
                top: '0',
                bottom: '0',
                right: '0',
                left: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                zIndex: 1000,
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                minWidth: '150px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Spin size="large" />
              </div>
            </div>
          )}
          {isDocHistoryLocked && docHistory.length > 1 && (
            <Typography.Title level={5} style={{ margin: '5px 0' }}>
              <Tooltip title={t('document.upgradePlanForFullHistory')}>
                <InfoCircleOutlined
                  style={{ color: 'orange' }}
                  onClick={() => {
                    showAppModal({
                      type: 'updateSubscription',
                      payload: {
                        email: user.email,
                        source: 'docHistory',
                        destination: 'docHistory',
                      },
                    });
                  }}
                />
              </Tooltip>
              &nbsp;{t('document.upgradePlanForFullVersionHistory')}
            </Typography.Title>
          )}
          <div
            style={{
              flex: 1,
              width: '100%',
              marginBottom: 40,
              marginTop: isDocHistoryLocked ? 0 : '10px',
            }}
          >
            <List
              itemLayout="horizontal"
              dataSource={(isDocHistoryLocked
                ? docHistory.slice(0, 1)
                : docHistory
              ).sort((x, y) => {
                const dateX = new Date(x.date || x.createdAt || '').getTime();
                const dateY = new Date(y.date || y.createdAt || '').getTime();
                return dateY - dateX;
              })}
              renderItem={(item, index) => {
                // Use versionNumber from the item directly
                const versionNumber =
                  item.versionNumber || docHistory.length - index;

                // Check if this version is selected based on document.meta.activeHistoryVersion or temporary selection
                const documentMeta = document?.meta as Prisma.JsonObject;
                let activeHistoryVersion = documentMeta?.activeHistoryVersion;

                // If there's a temporary selection (user is previewing), use that
                // Otherwise, use the active history version from the database
                const isSelected =
                  tempSelectedVersion !== null
                    ? tempSelectedVersion === versionNumber
                    : activeHistoryVersion
                      ? activeHistoryVersion === versionNumber
                      : index === 0; // Default to latest version if no activeHistoryVersion

                // Check if this is the current active version (restored/generated)
                const isCurrentVersion = activeHistoryVersion
                  ? activeHistoryVersion === versionNumber
                  : index === 0; // Default to latest version if no activeHistoryVersion

                const existingRating = (item?.rating ?? []).find(
                  (x: { userId: string; value: number }) => x.userId === user.id
                );
                const isLastGenerated = index === 0;
                const customStyle = isLastGenerated
                  ? {
                      paddingTop: '0.5em',
                      width: '98%',
                    }
                  : { padding: '6px 0', width: '98%' };

                return (
                  <List.Item style={customStyle}>
                    <Flex
                      vertical
                      onClick={() => onSelectDoc(item, versionNumber)}
                      className={`doc-history-item ${
                        isSelected ? 'selected' : ''
                      }`}
                    >
                      {isLastGenerated && existingRating == null && (
                        <FeedbackRating
                          refresh={onRefetchDocument}
                          disabled={!isLastGenerated}
                          docData={document}
                          existingRating={(item.rating ?? []).find(
                            ({ userId }: { userId: string; value: number }) =>
                              userId === user.id
                          )}
                          historyData={item}
                          userId={user.id}
                        />
                      )}
                      <Flex
                        gap={2}
                        align="center"
                        justify="space-between"
                        style={{ fontSize: '10px !important' }}
                      >
                        <Typography.Text strong style={{ fontSize: 11 }}>
                          <Tag color={COLORS.PRIMARY} style={{ fontSize: 10 }}>
                            V{versionNumber}
                          </Tag>
                          {isCurrentVersion && (
                            <Tag
                              color="green"
                              style={{ fontSize: 9, marginLeft: 4 }}
                            >
                              CURRENT
                            </Tag>
                          )}
                          {dayjs(item.date || item.createdAt).format(
                            'MM/DD/YYYY h:mm A'
                          )}
                        </Typography.Text>
                        {(existingRating != null || !isLastGenerated) && (
                          <FeedbackRating
                            refresh={onRefetchDocument}
                            disabled={true}
                            docData={document}
                            existingRating={(item.rating ?? []).find(
                              ({ userId }: { userId: string; value: number }) =>
                                userId === user.id
                            )}
                            historyData={item}
                            userId={user.id}
                          />
                        )}
                      </Flex>
                      <div style={{ marginBottom: 0, maxWidth: '95%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography.Paragraph
                            style={{
                              marginTop: 3,
                              marginBottom: 0,
                              fontSize: 12,
                              flex: 1,
                            }}
                            ellipsis={
                              isSelected
                                ? false
                                : { rows: 2, expandable: true, symbol: '' }
                            }
                          >
                            {item.description}
                          </Typography.Paragraph>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginLeft: 8,
                            }}
                          >
                            {/* <Tooltip
                              title={
                                copiedItems.has(
                                  `${item.description}-${versionNumber}`
                                )
                                  ? 'Copied!'
                                  : 'Copy'
                              }
                            >
                              {copiedItems.has(
                                `${item.description}-${versionNumber}`
                              ) ? (
                                <CheckOutlined
                                  style={{
                                    fontSize: 12,
                                    color: '#52c41a',
                                    cursor: 'pointer',
                                  }}
                                />
                              ) : (
                                <CopyOutlined
                                  style={{
                                    fontSize: 12,
                                    color: COLORS.PRIMARY,
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      item.description
                                    );
                                    setCopiedItems((prev) =>
                                      new Set(prev).add(
                                        `${item.description}-${versionNumber}`
                                      )
                                    );
                                    // Reset the copied state after 2 seconds
                                    setTimeout(() => {
                                      setCopiedItems((prev) => {
                                        const newSet = new Set(prev);
                                        newSet.delete(
                                          `${item.description}-${versionNumber}`
                                        );
                                        return newSet;
                                      });
                                    }, 2000);
                                  }}
                                />
                              )}
                            </Tooltip> */}
                            <Tooltip title="Restore">
                              <UndoOutlined
                                style={{
                                  fontSize: 12,
                                  color: COLORS.PRIMARY,
                                  cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreVersion(item, versionNumber);
                                }}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </Flex>
                  </List.Item>
                );
              }}
            />
          </div>
        </Flex>
      </Drawer>
    </>
  );
}

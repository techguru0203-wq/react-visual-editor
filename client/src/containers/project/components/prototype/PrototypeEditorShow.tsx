import React, { useEffect, useRef, useState } from 'react';
import { Document, Prisma, SubscriptionTier } from '@prisma/client';
import { Flex, Spin } from 'antd';

import { ProjectAccessResponse } from '../../../../../../shared/types';
import { useAppModal } from '../../../../common/components/AppModal';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { ReactComponent as EmptyIcon } from '../../../../common/icons/empty-icon.svg';
import { COLORS } from '../../../../lib/constants';
import { DocumentTypeNameMapping } from '../../../documents/types/documentTypes';
import useUserProfileQuery from '../../../profile/hooks/useUserProfileQuery';
import {
  FileComparisonResult,
  ProjectFile,
  PrototypeEditor,
} from './PrototypeEditor';
import { PrototypeEditorToolbar } from './PrototypeEditorToolbar';

export interface DocumentBase extends Omit<Document, 'content'> {
  contentStr: string | null;
  content: Buffer | null;
  contents: string | null;
  project: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  meta: Record<string, any> | null;
  imageBase64: string | null;
  templateDocument: any | null;
}

export type DocumentWithoutContent = Readonly<Partial<DocumentBase>>;

// Component to render toolbar when there are no files (with disabled buttons)
const EmptyStateToolbar: React.FC<{
  onToolbarRender?: (toolbar: React.ReactNode) => void;
  document?: DocumentWithoutContent;
  access?: ProjectAccessResponse;
  onShare?: () => void;
  onSaveStateChange?: (state: {
    onSave: () => void;
    hasUnsavedChanges: boolean;
    isEditing: boolean;
    hasFiles: boolean;
    isReadOnly: boolean;
  }) => void;
}> = ({ onToolbarRender, document, access, onShare, onSaveStateChange }) => {
  const { showAppModal } = useAppModal();
  const { user } = useCurrentUser();
  const { data: userProfile } = useUserProfileQuery(user.id);

  useEffect(() => {
    const isReadOnly = access?.projectPermission === 'VIEW';
    const canViewLogs =
      userProfile?.subscriptionTier === SubscriptionTier.PRO ||
      userProfile?.subscriptionTier === SubscriptionTier.BUSINESS ||
      userProfile?.subscriptionTier === SubscriptionTier.ENTERPRISE;

    if (onToolbarRender) {
      // Get deployment info from document meta
      const deployUrl = document?.meta?.deployUrl as string | undefined;
      const previewDeploymentId = document?.meta?.previewDeploymentId as
        | string
        | undefined;
      const productionDeploymentId = document?.meta?.productionDeploymentId as
        | string
        | undefined;
      const productionUrl = document?.meta?.productionUrl as string | undefined;
      const previewUrl = document?.meta?.previewUrl as string | undefined;

      const toolbar = (
        <PrototypeEditorToolbar
          viewMode="preview"
          previewMode="desktop"
          isReadOnly={isReadOnly}
          hasUnsavedChanges={false}
          isEditing={false}
          access={access}
          docId={document?.id || ''}
          deployUrl={deployUrl}
          previewDeploymentId={previewDeploymentId}
          productionDeploymentId={productionDeploymentId}
          productionUrl={productionUrl}
          previewUrl={previewUrl}
          onViewModeChange={() => {}} // Disabled
          onPreviewModeChange={() => {}} // Disabled
          onSave={() => {}} // Disabled
          onViewDiff={undefined} // No diff available
          onViewLogs={() => {
            if (canViewLogs) {
              // Will be handled by parent when files are available
            } else {
              showAppModal({
                type: 'updateSubscription',
                payload: {
                  email: user.email,
                  source: 'prototypeEditor',
                  destination: 'viewLogs',
                },
              });
            }
          }}
          onShare={onShare}
          hasFiles={false} // Indicate no files available
        />
      );
      onToolbarRender(toolbar);
    }
    // Expose save button state for empty state
    if (onSaveStateChange) {
      onSaveStateChange({
        onSave: () => {},
        hasUnsavedChanges: false,
        isEditing: false,
        hasFiles: false,
        isReadOnly,
      });
    }
    return () => {
      if (onToolbarRender) {
        onToolbarRender(null);
      }
      if (onSaveStateChange) {
        onSaveStateChange({
          onSave: () => {},
          hasUnsavedChanges: false,
          isEditing: false,
          hasFiles: false,
          isReadOnly: false,
        });
      }
    };
  }, [
    onToolbarRender,
    document,
    access,
    userProfile,
    user.email,
    showAppModal,
    onShare,
    onSaveStateChange,
  ]);

  return null;
};

interface PrototypeEditorShowProps {
  setSourceUrl: (sourceUrl: string) => void;
  document?: DocumentWithoutContent;
  access?: ProjectAccessResponse;
  onFixErrorsClick: (chatContent: string) => void;
  projectFiles?: ProjectFile[];
  prototypeSourceUrl?: string;
  onDeployRef?: (deployFn: () => Promise<void>) => void;
  refetchDocument?: () => void;
  onViewDiff?: () => void;
  onGetCurrentFiles?: (getCurrentFilesFn: () => ProjectFile[]) => void;
  onFileComparisonChange?: (comparison: FileComparisonResult | null) => void;
  onToolbarRender?: (toolbar: React.ReactNode) => void;
  onShare?: () => void; // Share handler
  onSaveStateChange?: (state: {
    onSave: () => void;
    hasUnsavedChanges: boolean;
    isEditing: boolean;
    hasFiles: boolean;
    isReadOnly: boolean;
  }) => void; // Callback to expose save button state
  onVisualEditStateChange?: (state: {
    enabled: boolean;
    ready: boolean;
    onToggle: (enabled: boolean) => void;
  }) => void; // Callback to expose visual edit state
}

function PrototypeEditorShow({
  setSourceUrl,
  document,
  access,
  onFixErrorsClick,
  projectFiles,
  prototypeSourceUrl,
  onDeployRef,
  refetchDocument,
  onViewDiff,
  onGetCurrentFiles,
  onFileComparisonChange,
  onToolbarRender,
  onShare,
  onSaveStateChange,
  onVisualEditStateChange,
}: PrototypeEditorShowProps) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousFilesRef = useRef<string>('');

  // Reset state when document changes
  useEffect(() => {
    if (document?.id) {
      setFiles([]);
      setError(null);
      setIsLoading(true);
      previousFilesRef.current = '';
      // Clear toolbar when document changes
      if (onToolbarRender) {
        onToolbarRender(null);
      }
    }
  }, [document?.id, onToolbarRender]);

  useEffect(() => {
    if (projectFiles && projectFiles.length > 0 && prototypeSourceUrl) {
      setFiles(projectFiles);
      setSourceUrl(prototypeSourceUrl);
      setIsLoading(false);
      return;
    }

    const processDocumentFiles = () => {
      try {
        if (!document?.id) {
          console.log('No document ID, skipping file processing');
          throw new Error('Document is required');
        }

        if (!document.contents) {
          console.log('No contents in document, setting empty files array');
          setFiles([]);
          setIsLoading(false);
          return;
        }

        try {
          const contentsData = JSON.parse(document.contents);
          // console.log('Parsed contents data:', contentsData);

          if (
            !contentsData ||
            !contentsData.files ||
            !Array.isArray(contentsData.files)
          ) {
            console.error(
              'Invalid file data format: expected an object with files array',
              {
                hasContentsData: !!contentsData,
                hasFiles: contentsData?.files,
                isArray: Array.isArray(contentsData?.files),
              }
            );
            return;
          }

          const projectFiles: ProjectFile[] = contentsData.files.map(
            (file: any) => {
              // Ensure content is string, with special handling for package.json
              let fileContent = file.content;
              if (
                file.path === 'package.json' &&
                typeof fileContent === 'object'
              ) {
                fileContent = JSON.stringify(fileContent, null, 2);

                // console.log('package.json fileContent: ', fileContent);
              } else if (typeof fileContent !== 'string') {
                fileContent = String(fileContent);
              }

              return {
                type: 'file' as const,
                content: fileContent,
                path: file.path,
              };
            }
          );

          // Only update if files have actually changed
          const newFilesStr = JSON.stringify(projectFiles);

          if (previousFilesRef.current !== newFilesStr) {
            console.log('Files have changed, updating state with new files:', {
              fileCount: projectFiles.length,
            });
            setFiles(projectFiles);
            previousFilesRef.current = newFilesStr;
          }
        } catch (err) {
          console.error('Error parsing document contents:', err);
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'Failed to parse document contents';
          setError(errorMessage);
        }
      } catch (err) {
        console.log('Processed err:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to process files';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    processDocumentFiles();
  }, [
    projectFiles,
    prototypeSourceUrl,
    document?.id,
    document?.contents,
    document,
    setSourceUrl,
  ]);

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Update sourceUrl when document.meta.sourceUrl changes (e.g., after deployment)
  useEffect(() => {
    const metaSourceUrl = document?.meta?.sourceUrl as string | undefined;
    if (metaSourceUrl && !prototypeSourceUrl) {
      setSourceUrl(metaSourceUrl);
    }
  }, [document?.meta?.sourceUrl, prototypeSourceUrl, setSourceUrl]);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Spin size="large" />
        <div>{t('prototypeEditor.loadingAppPreview')}</div>
      </div>
    );
  }

  // Show error if exists and not loading
  if (error && !isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
          {error}
        </div>
      </div>
    );
  }

  let documentName = document?.type
    ? DocumentTypeNameMapping(t)[document.type].name.toLowerCase()
    : 'app';
  return (
    <div
      className="web-container-show"
      style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
    >
      <Flex vertical style={{ flex: 1, minHeight: 0 }}>
        <Flex style={{ flex: 1, minHeight: 0 }}>
          {files.length > 0 ? (
            <PrototypeEditor
              sourceUrl={prototypeSourceUrl || document?.meta?.sourceUrl}
              projectFiles={files}
              docId={document?.id as string}
              documentMeta={document?.meta as Prisma.JsonObject}
              onError={handleError}
              setSourceUrl={setSourceUrl}
              access={access}
              onFixErrorsClick={onFixErrorsClick}
              onDeployRef={onDeployRef}
              refetchDocument={refetchDocument}
              onViewDiff={onViewDiff}
              onGetCurrentFiles={onGetCurrentFiles}
              onFileComparisonChange={onFileComparisonChange}
              onToolbarRender={onToolbarRender}
              documentType={document?.type}
              onShare={onShare}
              onSaveStateChange={onSaveStateChange}
              onVisualEditStateChange={onVisualEditStateChange}
            />
          ) : (
            <>
              {/* Render toolbar even when no files, but with disabled buttons */}
              {onToolbarRender && (
                <EmptyStateToolbar
                  onToolbarRender={onToolbarRender}
                  document={document}
                  access={access}
                  onShare={onShare}
                  onSaveStateChange={onSaveStateChange}
                />
              )}
              <Flex align="center" justify="center" style={{ flex: 1 }}>
                <div
                  style={{
                    textAlign: 'center',
                    color: COLORS.GRAY,
                    margin: '50px',
                  }}
                >
                  <EmptyIcon />
                  <div
                    style={{
                      fontSize: '16px',
                      marginBottom: '12px',
                      color: '#333',
                    }}
                  >
                    {t('prototypeEditor.chatWithJoyToCreate').replace(
                      '{documentName}',
                      documentName
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.5',
                      textAlign: 'center',
                    }}
                  >
                    {t('prototypeEditor.noDocumentCreatedYet').replace(
                      '{documentName}',
                      documentName
                    )}
                  </div>
                </div>
              </Flex>
            </>
          )}
        </Flex>
      </Flex>
    </div>
  );
}

export default PrototypeEditorShow;

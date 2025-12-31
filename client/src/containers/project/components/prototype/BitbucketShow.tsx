import { useEffect, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, message, Modal, Tooltip } from 'antd';
import { SiBitbucket } from 'react-icons/si';
import { useNavigate } from 'react-router-dom';

import {
  translateStatusMessage,
  viewOnlyMessage,
} from '../../../../common/constants';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { resetRepoUrl } from '../../../../common/util/resetRepoUrl';
import { api_url } from '../../../../lib/constants';
import { BitbucketUserProfile } from '../../../../shared/types/bitbucketTypes';
import trackEvent from '../../../../trackingClient';
import {
  createAndUploadToBitbucket,
  syncFromBitbucket,
  syncToBitbucket,
} from '../../api/bitbucketApi';
import useDocumentMutation from '../../hooks/useDocumentMutation';
import { ProjectFile } from './PrototypeEditor';
import { DocumentWithoutContent } from './PrototypeEditorShow';

interface BitbucketShowProps {
  document?: DocumentWithoutContent;
  onClose: () => void;
  setBitbucketRepoUrl?: (repoUrl: string) => void;
  bitbucketUserProfile?: BitbucketUserProfile;
  bitbucketRepoUrl: string;
  isBitbucketConnected: boolean;
  toolbarDisabled: boolean;
  isReadOnly: boolean;
  onRefresh?: () => void;
}

export default function BitbucketShow({
  document,
  onClose,
  setBitbucketRepoUrl,
  bitbucketUserProfile,
  bitbucketRepoUrl,
  isBitbucketConnected,
  toolbarDisabled,
  isReadOnly,
  onRefresh,
}: BitbucketShowProps) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const deployMessageKey = 'bitbucket-sync-deploy';
  const [repoName, setRepoName] = useState(
    document?.name
      ? String(document.name).toLowerCase().replace(/\s+/g, '-')
      : ''
  );
  const [branchName, setBranchName] = useState('master');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const { upsertDocumentMutation } = useDocumentMutation({
    onSuccess: () => {},
    onError: () => {},
  });

  const handleBitbucketView = () => {
    if (document?.meta?.repoUrl) {
      window.open(document?.meta?.repoUrl, '_blank');
    }
  };

  const handleRepoNameSubmit = async () => {
    if (!repoName.trim()) {
      message.error('Repository name cannot be empty');
      return;
    }
    if (!document?.id || !document?.name) {
      message.error('Document information is missing');
      return;
    }
    setIsUploading(true);
    try {
      message.loading('Creating repository and uploading files...', 0);
      const { repoUrl } = await createAndUploadToBitbucket(
        files,
        repoName,
        document.description || ''
      );
      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        meta: {
          ...document?.meta,
          repoUrl: repoUrl || '',
        },
      });
      message.destroy();
      message.success('Successfully uploaded to Bitbucket!');
      if (
        repoUrl &&
        typeof repoUrl === 'string' &&
        repoUrl.includes('bitbucket')
      ) {
        setBitbucketRepoUrl?.(repoUrl);
      } else {
        setBitbucketRepoUrl?.('');
      }
      onClose();
      window.open(repoUrl, '_blank');
    } catch (error) {
      message.destroy();
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to upload to Bitbucket';
      message.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncToBitbucket = async () => {
    if (!repoName.trim()) {
      message.error('Repository name is missing');
      return;
    }
    if (!branchName.trim()) {
      message.error('Branch name is missing');
      return;
    }
    if (!bitbucketUserProfile?.accessToken) {
      message.error(
        'Bitbucket user is not authenticated. Please connect to Bitbucket.'
      );
      navigate('/settings/bitbucket');
      return;
    }
    setIsUploading(true);
    message.loading('Syncing with Bitbucket...', 0);

    try {
      await syncToBitbucket(
        files,
        repoName,
        branchName,
        `Sync update from Omniflow`
      );

      // Save branch name to document meta for next time
      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        meta: {
          ...document?.meta,
          bitbucketBranch: branchName,
        },
      });

      message.destroy();
      message.success(
        `Synced to Bitbucket branch (${branchName}) successfully`
      );
    } catch (err) {
      message.destroy();
      const errMsg = err instanceof Error ? err.message : 'Failed to sync';
      message.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncFromBitbucket = async () => {
    if (!repoName.trim()) {
      message.error('Repository name is missing');
      return;
    }
    if (!branchName.trim()) {
      message.error('Branch name is missing');
      return;
    }
    if (!bitbucketUserProfile?.accessToken) {
      message.error(
        'Bitbucket user is not authenticated. Please connect to Bitbucket.'
      );
      navigate('/settings/bitbucket');
      return;
    }
    setIsUploading(true);
    message.loading('Pulling latest changes from Bitbucket...', 0);
    try {
      const pulledFiles = await syncFromBitbucket(repoName, branchName);
      console.log('sync from bitbucket successful.');
      setFiles(pulledFiles);
      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        contentStr: JSON.stringify({ files: pulledFiles }),
        meta: {
          ...document?.meta,
          bitbucketBranch: branchName,
        },
      });
      message.destroy();
      message.success(
        `Pulled latest changes from Bitbucket branch (${branchName})`
      );

      // Automatically trigger deployment after sync
      if (document?.id && pulledFiles.length > 0) {
        message.loading({
          content: t('sync.deployingUpdatedCode'),
          key: deployMessageKey,
          duration: 0,
        });
        try {
          const headers = await getHeaders();
          const response = await fetch(
            `${api_url}/api/deploy/deployToVercel-streaming`,
            {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                documentId: document.id,
                files: pulledFiles,
              }),
            }
          );

          if (!response.ok) {
            throw new Error('Deployment request failed');
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n\n');

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const parsed = JSON.parse(line);
                  if (parsed.status?.message) {
                    const statusMessage = translateStatusMessage(
                      parsed.status.message,
                      t
                    );
                    message.loading({
                      content: statusMessage,
                      key: deployMessageKey,
                      duration: 0,
                    });
                  }
                  if (parsed.sourceUrl) {
                    message.destroy(deployMessageKey);
                    message.success({
                      content: t('sync.deploymentSuccessful'),
                      key: deployMessageKey,
                      duration: 2,
                    });
                    break;
                  }
                  if (parsed.error) {
                    message.destroy(deployMessageKey);
                    message.error({
                      content: t('sync.deploymentFailed', {
                        error: parsed.error,
                      }),
                      key: deployMessageKey,
                      duration: 3,
                    });
                    break;
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        } catch (deployError) {
          message.destroy(deployMessageKey);
          console.error('Deployment error:', deployError);
          // Don't show error to user as sync was successful
        }
      }
    } catch (err) {
      message.destroy();
      const errMsg =
        err instanceof Error ? err.message : 'Failed to sync from Bitbucket';
      message.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const onBitbucketLogin = () => {
    // track event
    trackEvent('connectBitbucket', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: document?.id,
      }),
    });
    navigate('/settings/bitbucket');
  };

  const handleResetRepoUrl = async () => {
    if (!document?.id) {
      message.error('Document ID is missing');
      return;
    }

    // Show confirmation dialog
    Modal.confirm({
      title: 'Reset Repository URL',
      content:
        'Are you sure you want to reset the repository URL? This will disconnect the current repository and you will need to connect a new one.',
      okText: 'Reset',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const success = await resetRepoUrl(
          document.id || '',
          document.meta,
          setBitbucketRepoUrl
        );

        if (success) {
          // Reset local state to initial values
          setRepoName(
            document?.name
              ? String(document.name).toLowerCase().replace(/\s+/g, '-')
              : ''
          );

          // Force clear the repo URL state to show original UI
          setBitbucketRepoUrl?.('');

          // Small delay to ensure state updates are processed
          setTimeout(() => {
            setBitbucketRepoUrl?.('');
          }, 100);

          // Track the reset event
          trackEvent('resetBitbucketRepoUrl', {
            distinct_id: user.email,
            payload: JSON.stringify({
              documentId: document.id,
            }),
          });

          // Force parent component to refresh with a small delay to ensure DB update is processed
          console.log('BitbucketShow: Calling onRefresh after reset');
          setTimeout(() => {
            onRefresh?.();
          }, 200);
        }
      },
    });
  };
  // Extract repo name from Bitbucket URL
  useEffect(() => {
    if (bitbucketRepoUrl) {
      try {
        // Extract repo name from URL like https://bitbucket.org/workspace/repo
        // Handle various URL formats: https://bitbucket.org/workspace/repo, https://bitbucket.org/workspace/repo/src/branch, etc.
        // We only need the repo name because backend gets workspace from user profile
        const match = bitbucketRepoUrl.match(
          /bitbucket\.org\/[^\/]+\/([^\/]+)/
        );
        if (match && match[1]) {
          setRepoName(match[1]);
        }
      } catch (err) {
        console.error('Error extracting repo name from URL:', err);
      }
    }
  }, [bitbucketRepoUrl]);

  useEffect(() => {
    const processDocumentFiles = () => {
      try {
        if (!document?.id) {
          throw new Error('Document is required');
        }
        if (!document.contents) {
          return;
        }
        const contentsData = JSON.parse(document.contents);
        if (
          !contentsData ||
          !contentsData.files ||
          !Array.isArray(contentsData.files)
        ) {
          setFiles([]);
          return;
        }
        const projectFiles: ProjectFile[] = contentsData.files.map(
          (file: any) => {
            let fileContent = file.content;
            if (
              file.path === 'package.json' &&
              typeof fileContent === 'object'
            ) {
              fileContent = JSON.stringify(fileContent, null, 2);
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
        setFiles(projectFiles);
      } catch (err) {
        setFiles([]);
      }
    };

    // Get the latest bitbucketRepoUrl from document meta
    if (
      document?.meta?.repoUrl &&
      document?.meta?.repoUrl.includes('bitbucket')
    ) {
      setBitbucketRepoUrl?.(document.meta.repoUrl);
      setRepoName(document.meta.repoUrl.split('/').slice(-1)[0]);
    }

    // Load saved branch name from document meta
    if (document?.meta?.bitbucketBranch) {
      setBranchName(document.meta.bitbucketBranch as string);
    }

    processDocumentFiles();
  }, [
    document?.id,
    document?.contents,
    document?.meta?.repoUrl,
    document?.meta?.bitbucketBranch,
  ]);

  return (
    <Dropdown
      menu={{
        items: [
          bitbucketRepoUrl && {
            key: 'view',
            label: 'View on Bitbucket',
            icon: <EyeOutlined />,
            onClick: handleBitbucketView,
          },
          bitbucketRepoUrl && {
            key: 'branchInput',
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Branch</div>
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="master"
                  style={{
                    width: 180,
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ),
            disabled: true,
          },
          bitbucketRepoUrl && {
            key: 'syncTo',
            label: `Sync to Bitbucket branch (${branchName})`,
            icon: <ArrowUpOutlined />,
            onClick: handleSyncToBitbucket,
          },
          bitbucketRepoUrl && {
            key: 'syncFrom',
            label: `Sync from Bitbucket branch (${branchName})`,
            icon: <ArrowDownOutlined />,
            onClick: handleSyncFromBitbucket,
          },
          !bitbucketRepoUrl &&
            isBitbucketConnected &&
            files.length > 0 && {
              key: 'repoNameInput',
              label: (
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>
                    Create New Repo
                  </div>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="your-repo-name"
                    style={{
                      width: 180,
                      padding: '4px 8px',
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Note: Initial upload will create 'master' branch
                  </div>
                </div>
              ),
              disabled: true,
            },
          !bitbucketRepoUrl &&
            isBitbucketConnected &&
            files.length > 0 && {
              key: 'upload',
              label: 'Upload to Bitbucket',
              icon: <SiBitbucket style={{ fontSize: 16, color: '#205081' }} />,
              onClick: handleRepoNameSubmit,
            },
          !bitbucketRepoUrl &&
            !isBitbucketConnected && {
              key: 'login',
              label: 'Connect Bitbucket',
              icon: <SiBitbucket style={{ fontSize: 16, color: '#205081' }} />,
              onClick: onBitbucketLogin,
            },
          // reset repo URL button - only show if there's a repo URL
          bitbucketRepoUrl && {
            key: 'resetRepo',
            label: 'Reset Repository URL',
            icon: <DeleteOutlined />,
            onClick: handleResetRepoUrl,
            danger: true,
          },
        ].filter(Boolean) as MenuProps['items'],
      }}
      placement="bottomLeft"
      trigger={['click']}
    >
      <Tooltip
        title={isReadOnly ? viewOnlyMessage : 'Connect app to Bitbucket'}
      >
        <Button
          type="link"
          disabled={isReadOnly || toolbarDisabled}
          style={{
            padding: 0,
            color: 'black',
            opacity: isReadOnly || toolbarDisabled ? 0.5 : 1.0,
          }}
        >
          <SiBitbucket style={{ color: '#205081', fontSize: 18 }} />
          Bitbucket
        </Button>
      </Tooltip>
    </Dropdown>
  );
}

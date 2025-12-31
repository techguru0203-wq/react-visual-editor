import { useEffect, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, message, Modal, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  translateStatusMessage,
  viewOnlyMessage,
} from '../../../../common/constants';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { resetRepoUrl } from '../../../../common/util/resetRepoUrl';
import { api_url, COLORS } from '../../../../lib/constants';
import { GithubUserProfile } from '../../../../shared/types/githubTypes';
import trackEvent from '../../../../trackingClient';
import {
  createAndUploadToGithub,
  syncFromGithub,
  syncToGithub,
} from '../../api/githubApi';
import useDocumentMutation from '../../hooks/useDocumentMutation';
import { ProjectFile } from './PrototypeEditor';
import { DocumentWithoutContent } from './PrototypeEditorShow';

interface GitHubShowProps {
  document?: DocumentWithoutContent;
  onClose: () => void;
  setGithubRepoUrl?: (repoUrl: string) => void;
  githubUserProfile?: GithubUserProfile;
  githubRepoUrl: string;
  isGithubConnected: boolean;
  toolbarDisabled: boolean;
  isReadOnly: boolean;
  onRefresh?: () => void;
}

export default function GitHubShow({
  document,
  onClose,
  setGithubRepoUrl,
  githubUserProfile,
  githubRepoUrl,
  isGithubConnected,
  toolbarDisabled,
  isReadOnly,
  onRefresh,
}: GitHubShowProps) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const deployMessageKey = 'github-sync-deploy';
  const [repoName, setRepoName] = useState(
    document?.name
      ? String(document.name).toLowerCase().replace(/\s+/g, '-')
      : ''
  );
  const [branchName, setBranchName] = useState('main');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const [importRepoUrl, setImportRepoUrl] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const { upsertDocumentMutation } = useDocumentMutation({
    onSuccess: () => {
      console.log('upsertDocumentMutation.success');
    },
    onError: () => {
      console.error('error');
    },
  });

  const handleGitHubView = () => {
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

      const { repoUrl } = await createAndUploadToGithub(
        files,
        repoName,
        document.description || '',
        githubUserProfile?.accessToken || '',
        githubUserProfile?.userName || ''
      );

      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        meta: {
          ...document?.meta,
          repoUrl: repoUrl || '',
        },
      });

      message.destroy();
      message.success('Successfully uploaded to GitHub!');
      setGithubRepoUrl?.(repoUrl);
      onClose();
      // by default open github url after upload success
      window.open(repoUrl, '_blank');
    } catch (error) {
      message.destroy();
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to upload to GitHub';

      if (errorMessage.includes('Repository already exists')) {
        message.error(errorMessage);
      } else {
        message.error(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncToGitHub = async () => {
    if (!repoName.trim()) {
      message.error('Repository name is missing');
      return;
    }
    if (!branchName.trim()) {
      message.error('Branch name is missing');
      return;
    }

    // track event
    trackEvent('syncToGitHub', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: document?.id,
        repoName: repoName,
        branchName: branchName,
      }),
    });

    if (!githubUserProfile?.accessToken) {
      message.error('GitHub user is not authenticated');
      return;
    }

    setIsUploading(true);
    message.loading('Syncing with GitHub...', 0);

    try {
      await syncToGithub(
        files,
        repoName,
        branchName,
        githubUserProfile.accessToken,
        `Sync update from Omniflow`
      );

      // Save branch name to document meta for next time
      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        meta: {
          ...document?.meta,
          githubBranch: branchName,
        },
      });

      message.destroy();
      message.success(`Synced to GitHub branch (${branchName}) successfully`);
    } catch (err) {
      message.destroy();
      const errMsg = err instanceof Error ? err.message : 'Failed to sync';
      message.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncFromGitHub = async () => {
    if (!repoName.trim()) {
      message.error('Repository name is missing');
      return;
    }
    if (!branchName.trim()) {
      message.error('Branch name is missing');
      return;
    }

    if (!githubUserProfile?.accessToken) {
      message.error('GitHub user is not authenticated');
      return;
    }

    // track event
    trackEvent('syncFromGitHub', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: document?.id,
        repoName: repoName,
        branchName: branchName,
      }),
    });
    setIsUploading(true);
    message.loading('Pulling latest changes from GitHub...', 0);

    try {
      const pulledFiles = await syncFromGithub(
        repoName,
        githubUserProfile.accessToken,
        branchName
      );

      setFiles(pulledFiles);

      await upsertDocumentMutation.mutateAsync({
        id: document?.id,
        contentStr: JSON.stringify({ files: pulledFiles }),
        meta: {
          ...document?.meta,
          githubBranch: branchName,
        },
      });

      message.destroy();
      message.success(
        `Pulled latest changes from GitHub branch (${branchName})`
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
        err instanceof Error ? err.message : 'Failed to sync from GitHub';
      message.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const onGitHubLogin = () => {
    // track event
    trackEvent('connectGitHub', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: document?.id,
      }),
    });
    navigate('/settings/github');
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
          document?.id || '',
          document.meta,
          setGithubRepoUrl
        );

        if (success) {
          // Reset local state to initial values
          setRepoName(
            document?.name
              ? String(document.name).toLowerCase().replace(/\s+/g, '-')
              : ''
          );
          setBranchName('main');
          setImportRepoUrl('');

          // Force clear the repo URL state to show original UI
          setGithubRepoUrl?.('');

          // Small delay to ensure state updates are processed
          setTimeout(() => {
            setGithubRepoUrl?.('');
          }, 100);

          // Track the reset event
          trackEvent('resetGitHubRepoUrl', {
            distinct_id: user.email,
            payload: JSON.stringify({
              documentId: document.id,
            }),
          });

          // Force parent component to refresh with a small delay to ensure DB update is processed
          console.log('GitHubShow: Calling onRefresh after reset');
          setTimeout(() => {
            onRefresh?.();
          }, 200);
        }
      },
    });
  };
  // Extract repo name from GitHub URL
  useEffect(() => {
    if (githubRepoUrl) {
      try {
        // Extract repo name from URL like https://github.com/owner/repo
        // Handle various URL formats: https://github.com/owner/repo, https://github.com/owner/repo/tree/branch, etc.
        // We only need the repo name because backend gets owner from user profile
        const match = githubRepoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
        if (match && match[1]) {
          setRepoName(match[1]);
        }
      } catch (err) {
        console.error('Error extracting repo name from URL:', err);
      }
    }
  }, [githubRepoUrl]);

  useEffect(() => {
    const processDocumentFiles = () => {
      try {
        if (!document?.id) {
          console.log('No document ID, skipping file processing');
          throw new Error('Document is required');
        }

        if (!document.contents) {
          console.log('No contents in document, setting empty files array');
          return;
        }

        console.log('Processing document contents:', {
          type: typeof document.contents,
          value: document.contents,
        });

        try {
          const contentsData = JSON.parse(document.contents);
          console.log('Parsed contents data:', contentsData);

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
            setFiles([]);
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
          console.error('Error parsing document contents:', err);
          setFiles([]);
        }
      } catch (err) {
        console.log('Processed err:', err);
      } finally {
      }
    };

    // Get the latest githubRepoUrl from document meta
    if (document?.meta?.repoUrl && document?.meta?.repoUrl.includes('github')) {
      setGithubRepoUrl?.(document.meta.repoUrl as string);
      setRepoName(document.meta.repoUrl.split('/').slice(-1)[0]);
    }

    // Load saved branch name from document meta
    if (document?.meta?.githubBranch) {
      setBranchName(document.meta.githubBranch as string);
    }

    processDocumentFiles();
  }, [
    document?.id,
    document?.contents,
    document?.meta?.repoUrl,
    document?.meta?.githubBranch,
  ]);

  return (
    <Dropdown
      menu={{
        items: [
          githubRepoUrl && {
            key: 'view',
            label: 'View on GitHub',
            icon: <EyeOutlined />,
            onClick: handleGitHubView,
          },
          githubRepoUrl && {
            key: 'branchInput',
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Branch</div>
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="main"
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
          githubRepoUrl && {
            key: 'syncTo',
            label: `Sync to GitHub branch (${branchName})`,
            icon: <ArrowUpOutlined />,
            onClick: handleSyncToGitHub,
          },
          githubRepoUrl && {
            key: 'syncFrom',
            label: `Sync from GitHub branch (${branchName})`,
            icon: <ArrowDownOutlined />,
            onClick: handleSyncFromGitHub,
          },
          !githubRepoUrl &&
            isGithubConnected &&
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
                    Note: Initial upload will create 'main' branch
                  </div>
                </div>
              ),
              disabled: true, // prevent hover effect / click behavior
            },
          !githubRepoUrl &&
            isGithubConnected &&
            files.length > 0 && {
              key: 'upload',
              label: 'Upload to GitHub',
              icon: <GithubOutlined />,
              onClick: handleRepoNameSubmit,
            },
          !githubRepoUrl &&
            !isGithubConnected && {
              key: 'login',
              label: 'Connect GitHub',
              icon: <GithubOutlined />,
              onClick: onGitHubLogin,
            },
          // github repo import
          isGithubConnected && {
            key: 'importInput',
            label: (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  Import Existing Repo
                </div>
                <input
                  value={importRepoUrl}
                  onChange={(e) => setImportRepoUrl(e.target.value)}
                  placeholder="GitHub repo/branch name"
                  style={{
                    width: 220,
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
              </div>
            ),
            disabled: true,
          },
          // import button
          isGithubConnected && {
            key: 'importAction',
            label: 'Import from GitHub',
            icon: <ArrowDownOutlined />,
            onClick: async () => {
              if (!importRepoUrl.trim()) {
                message.error('Please enter a GitHub repo URL');
                return;
              }
              if (!githubUserProfile?.accessToken) {
                message.error('GitHub not connected');
                return;
              }

              setIsUploading(true);
              message.loading('Importing from GitHub...', 0);

              try {
                // default value is main
                const [repoPart, branchPart] = importRepoUrl.split('/');
                const repo = repoPart.trim();
                const branch = branchPart?.trim() || 'main';

                const pulledFiles = await syncFromGithub(
                  repo,
                  githubUserProfile.accessToken,
                  branch
                );

                setFiles(pulledFiles);

                await upsertDocumentMutation.mutateAsync({
                  id: document?.id,
                  contentStr: JSON.stringify({ files: pulledFiles }),
                  meta: {
                    ...document?.meta,
                    githubBranch: branch,
                  },
                });

                message.destroy();
                message.success(
                  `Successfully imported from GitHub (${branch})`
                );
              } catch (err) {
                message.destroy();
                const errMsg =
                  err instanceof Error ? err.message : 'Import failed';
                message.error(errMsg);
              } finally {
                setIsUploading(false);
              }
            },
          },
          // reset repo URL button - only show if there's a repo URL
          githubRepoUrl && {
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
      <Tooltip title={isReadOnly ? viewOnlyMessage : 'Connect app to GitHub'}>
        <Button
          type="link"
          disabled={isReadOnly || toolbarDisabled}
          style={{
            padding: 0,
            color: 'black',
            opacity: isReadOnly || toolbarDisabled ? 0.5 : 1.0,
          }}
        >
          <GithubOutlined style={{ color: COLORS.PRIMARY, fontSize: 18 }} />
          GitHub
        </Button>
      </Tooltip>
    </Dropdown>
  );
}

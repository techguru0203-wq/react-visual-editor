import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Tree, Flex, Typography, Empty, Spin, Select } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import MonacoDiffEditor from '../../../common/components/MonacoDiffEditor';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ProjectFile } from '../../project/components/prototype/PrototypeEditor';
import { compareFiles } from '../../project/utils/fileComparisonUtils';
import { useQuery } from '@tanstack/react-query';
import {
  getDocumentHistoryApi,
  getDocumentHistorySourceCodeApi,
  DocumentHistoryItem,
} from '../api/documentHistoryApi';

interface CodeDiffModalProps {
  open: boolean;
  onClose: () => void;
  currentFiles: ProjectFile[]; // Files from document.contents (LLM generated or saved code)
  docId: string;
  projectFiles?: ProjectFile[]; // Real-time files from PrototypeEditor (includes user modifications)
  versionNumber?: number; // Optional: specific version to compare against
}

interface FileTreeNode extends DataNode {
  key: string;
  title: React.ReactNode;
  path: string;
  isLeaf?: boolean;
  isModified?: boolean;
  children?: FileTreeNode[];
}

// Comparison mode types
type ComparisonMode =
  | { type: 'current-vs-saved' }
  | { type: 'version-vs-previous'; version: number };

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
    case 'jsx':
    case 'js':
      return 'typescript';
    case 'css':
      return 'css';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    default:
      return 'typescript';
  }
}

const CodeDiffModal: React.FC<CodeDiffModalProps> = ({
  open,
  onClose,
  currentFiles,
  docId,
  projectFiles,
  versionNumber,
}) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({
    type: 'current-vs-saved',
  });
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // Reset comparison mode when modal opens
  useEffect(() => {
    if (open) {
      setComparisonMode({ type: 'current-vs-saved' });
      setSelectedFile('');
      setIsSwitchingMode(false);
    }
  }, [open]);

  // Fetch document history list for the version selector
  const { data: historyList, isLoading: isLoadingHistoryList } = useQuery({
    queryKey: ['documentHistory', docId],
    queryFn: () => getDocumentHistoryApi(docId),
    enabled: open && !!docId,
    staleTime: 5 * 60 * 1000,
  });

  // Sort history list by version number (descending)
  const sortedHistoryList = useMemo(() => {
    if (!historyList) return [];
    return [...historyList].sort((a, b) => b.versionNumber - a.versionNumber);
  }, [historyList]);

  // Determine which versions to fetch based on comparison mode
  const { currentVersionToFetch, previousVersionToFetch } = useMemo(() => {
    if (comparisonMode.type === 'current-vs-saved') {
      return {
        currentVersionToFetch: versionNumber,
        previousVersionToFetch: undefined,
      };
    } else {
      const version = comparisonMode.version;
      return {
        currentVersionToFetch: version,
        previousVersionToFetch: version > 1 ? version - 1 : undefined,
      };
    }
  }, [comparisonMode, versionNumber]);

  // Fetch current/target version source code
  const {
    data: currentHistoryData,
    isLoading: isLoadingCurrentHistory,
    error: currentHistoryError,
  } = useQuery({
    queryKey: ['documentHistorySourceCode', docId, currentVersionToFetch],
    queryFn: () =>
      getDocumentHistorySourceCodeApi(docId, currentVersionToFetch),
    enabled: open && !!docId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch previous version source code (only for version-vs-previous mode)
  const {
    data: previousHistoryData,
    isLoading: isLoadingPreviousHistory,
    error: previousHistoryError,
  } = useQuery({
    queryKey: ['documentHistorySourceCode', docId, previousVersionToFetch],
    queryFn: () =>
      getDocumentHistorySourceCodeApi(docId, previousVersionToFetch!),
    enabled:
      open &&
      !!docId &&
      comparisonMode.type === 'version-vs-previous' &&
      previousVersionToFetch !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  const isLoadingHistory =
    isSwitchingMode ||
    isLoadingCurrentHistory ||
    (comparisonMode.type === 'version-vs-previous' && isLoadingPreviousHistory);
  const historyError =
    currentHistoryError ||
    (comparisonMode.type === 'version-vs-previous' && previousHistoryError);

  // Clear switching mode flag when data is loaded
  useEffect(() => {
    if (!isLoadingCurrentHistory && !isLoadingPreviousHistory) {
      setIsSwitchingMode(false);
    }
  }, [isLoadingCurrentHistory, isLoadingPreviousHistory]);

  // Get the appropriate files for comparison based on mode
  const { leftFiles, rightFiles, leftLabel, rightLabel } = useMemo(() => {
    if (comparisonMode.type === 'current-vs-saved') {
      // Current editor vs saved version
      const savedFiles = currentHistoryData?.sourceCode?.files || null;
      const filesToCompare =
        projectFiles && projectFiles.length > 0 ? projectFiles : currentFiles;
      return {
        leftFiles: savedFiles,
        rightFiles: filesToCompare,
        leftLabel: t('codeDiff.lastSaved'),
        rightLabel: t('codeDiff.currentChanges'),
      };
    } else {
      // Version vs previous version
      const currentVersionFiles = currentHistoryData?.sourceCode?.files || null;
      const previousVersionFiles =
        previousHistoryData?.sourceCode?.files || null;
      const version = comparisonMode.version;
      return {
        leftFiles: previousVersionFiles,
        rightFiles: currentVersionFiles,
        leftLabel: t('codeDiff.version', { version: version - 1 }),
        rightLabel: t('codeDiff.version', { version }),
      };
    }
  }, [
    comparisonMode,
    currentHistoryData,
    previousHistoryData,
    projectFiles,
    currentFiles,
    t,
  ]);

  // Build file comparison data
  const { fileMap, modifiedFiles } = useMemo<{
    fileMap: { current: Map<string, string>; saved: Map<string, string> };
    modifiedFiles: string[];
  }>(() => {
    // Handle "no previous version" case for version 1
    if (
      comparisonMode.type === 'version-vs-previous' &&
      comparisonMode.version === 1
    ) {
      // For version 1, compare with itself to show content without modifications
      const currentVersionFiles = currentHistoryData?.sourceCode?.files || [];
      const currentMap = new Map(
        currentVersionFiles.map((f: ProjectFile) => [f.path, f.content])
      );
      return {
        fileMap: {
          current: currentMap,
          saved: currentMap, // Same as current for V1
        },
        modifiedFiles: [], // No modifications when comparing with itself
      };
    }

    if (!leftFiles) {
      return {
        fileMap: {
          current: new Map<string, string>(),
          saved: new Map<string, string>(),
        },
        modifiedFiles: [] as string[],
      };
    }

    if (!rightFiles || rightFiles.length === 0) {
      return {
        fileMap: {
          current: new Map<string, string>(),
          saved: new Map<string, string>(),
        },
        modifiedFiles: [] as string[],
      };
    }

    const comparison = compareFiles(rightFiles, leftFiles);

    return {
      fileMap: {
        current: comparison.currentMap,
        saved: comparison.savedMap,
      },
      modifiedFiles: comparison.modifiedFiles,
    };
  }, [comparisonMode, leftFiles, rightFiles, currentHistoryData]);

  // Get files to display in tree
  const filesToDisplay = useMemo(() => {
    if (comparisonMode.type === 'version-vs-previous') {
      // For version comparison, use the newer version's files
      return currentHistoryData?.sourceCode?.files || [];
    }
    // For current vs saved, use project files or current files
    return projectFiles && projectFiles.length > 0
      ? projectFiles
      : currentFiles;
  }, [comparisonMode, currentHistoryData, projectFiles, currentFiles]);

  // Build file tree
  const fileTree = useMemo(() => {
    const tree: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    filesToDisplay.forEach((file) => {
      const parts = file.path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = index === 0 ? part : `${currentPath}/${part}`;

        if (!nodeMap.has(currentPath)) {
          const isLeaf = index === parts.length - 1;
          const isModified = modifiedFiles.includes(currentPath);

          const node: FileTreeNode = {
            key: currentPath,
            title: (
              <span>
                {part}{' '}
                {isLeaf &&
                  (isModified ? (
                    <EditOutlined style={{ color: '#faad14' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ))}
              </span>
            ),
            path: currentPath,
            isLeaf,
            isModified,
            children: [],
          };

          if (index === 0) {
            tree.push(node);
          } else {
            const parentPath = currentPath.substring(
              0,
              currentPath.lastIndexOf('/')
            );
            const parent = nodeMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          }

          nodeMap.set(currentPath, node);
        }
      });
    });

    return tree;
  }, [filesToDisplay, modifiedFiles]);

  // Auto-select first modified file on open
  useEffect(() => {
    if (open && modifiedFiles.length > 0 && !selectedFile) {
      setSelectedFile(modifiedFiles[0]);
      // Expand all parent directories of the first modified file
      const parts = modifiedFiles[0].split('/');
      const keys: string[] = [];
      let path = '';
      for (let i = 0; i < parts.length - 1; i++) {
        path = i === 0 ? parts[i] : `${path}/${parts[i]}`;
        keys.push(path);
      }
      setExpandedKeys(keys);
    }
  }, [open, modifiedFiles, selectedFile]);

  // Auto-select first file when modifiedFiles change or when V1 has no modifications
  useEffect(() => {
    if (!selectedFile) {
      let fileToSelect: string | null = null;

      // For V1 or when there are no modifications, select first available file
      if (modifiedFiles.length === 0 && filesToDisplay.length > 0) {
        fileToSelect = filesToDisplay[0].path;
      } else if (modifiedFiles.length > 0) {
        fileToSelect = modifiedFiles[0];
      }

      if (fileToSelect) {
        setSelectedFile(fileToSelect);
        const parts = fileToSelect.split('/');
        const keys: string[] = [];
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = i === 0 ? parts[i] : `${path}/${parts[i]}`;
          keys.push(path);
        }
        setExpandedKeys(keys);
      }
    }
  }, [modifiedFiles, selectedFile, filesToDisplay]);

  const handleFileSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const path = selectedKeys[0] as string;
      // Only select leaf nodes (files, not directories)
      const file = filesToDisplay.find((f) => f.path === path);
      if (file) {
        setSelectedFile(path);
      }
    }
  };

  const handleComparisonModeChange = (value: string) => {
    // Set switching flag to show loading state during mode transition
    setIsSwitchingMode(true);
    setSelectedFile(''); // Clear selected file to avoid stale data

    if (value === 'current-vs-saved') {
      setComparisonMode({ type: 'current-vs-saved' });
    } else {
      const version = parseInt(value.replace('version-', ''), 10);
      setComparisonMode({ type: 'version-vs-previous', version });
    }
  };

  // Build select options
  const selectOptions = useMemo(() => {
    const options = [
      {
        value: 'current-vs-saved',
        label: t('codeDiff.currentVsSaved'),
      },
    ];

    if (sortedHistoryList.length > 0) {
      sortedHistoryList.forEach((item: DocumentHistoryItem) => {
        const version = item.versionNumber;
        if (version === 1) {
          options.push({
            value: `version-${version}`,
            label: `V${version} (${t('codeDiff.noPreviousVersion')})`,
          });
        } else {
          options.push({
            value: `version-${version}`,
            label: t('codeDiff.historyComparison', {
              version,
              prevVersion: version - 1,
            }),
          });
        }
      });
    }

    return options;
  }, [sortedHistoryList, t]);

  const currentContent = fileMap.current.get(selectedFile) || '';
  const savedContent = fileMap.saved.get(selectedFile) || '';
  const language = selectedFile
    ? getLanguageFromFilename(selectedFile)
    : 'typescript';

  // Check if we're comparing version 1 (no previous version)
  const isVersion1Comparison =
    comparisonMode.type === 'version-vs-previous' &&
    comparisonMode.version === 1;

  return (
    <Modal
      title={t('codeDiff.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
    >
      {/* Version selector header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Typography.Text strong>
          {t('codeDiff.comparisonMode')}:
        </Typography.Text>
        <Select
          value={
            comparisonMode.type === 'current-vs-saved'
              ? 'current-vs-saved'
              : `version-${comparisonMode.version}`
          }
          onChange={handleComparisonModeChange}
          style={{ minWidth: 300 }}
          loading={isLoadingHistoryList}
          options={selectOptions}
        />
      </div>

      {isLoadingHistory ? (
        <Flex
          vertical
          justify="center"
          align="center"
          gap={12}
          style={{ height: 'calc(100% - 50px)', padding: 24 }}
        >
          <Spin size="large" />
          <Typography.Text type="secondary">
            {t('codeDiff.loadingHistory')}
          </Typography.Text>
        </Flex>
      ) : historyError ||
        (comparisonMode.type === 'current-vs-saved' && !leftFiles) ? (
        <Flex
          justify="center"
          align="center"
          style={{ height: 'calc(100% - 50px)', padding: 24 }}
        >
          <Empty
            description={
              historyError
                ? t('codeDiff.errorLoadingHistory')
                : t('codeDiff.noSavedVersion')
            }
          />
        </Flex>
      ) : (
        <Flex style={{ height: 'calc(100% - 50px)' }}>
          {/* File navigation sidebar */}
          <div
            style={{
              width: 220,
              borderRight: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modified files list */}
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: '#fafafa',
              }}
            >
              <Typography.Title
                level={5}
                style={{ margin: 0, marginBottom: 8, fontSize: 14 }}
              >
                {t('codeDiff.modifiedFiles')} ({modifiedFiles.length})
              </Typography.Title>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {modifiedFiles.length > 0 ? (
                  modifiedFiles.map((filePath) => {
                    const fileName = filePath.split('/').pop() || filePath;
                    return (
                      <div
                        key={filePath}
                        onClick={() => setSelectedFile(filePath)}
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: 4,
                          fontSize: 12,
                          backgroundColor:
                            selectedFile === filePath
                              ? '#e6f7ff'
                              : 'transparent',
                          marginBottom: 4,
                          wordBreak: 'break-all',
                        }}
                      >
                        <EditOutlined
                          style={{ color: '#faad14', marginRight: 6 }}
                        />
                        {fileName}
                        <div
                          style={{ fontSize: 11, color: '#999', marginTop: 2 }}
                        >
                          {filePath}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('codeDiff.noModifications')}
                  </Typography.Text>
                )}
              </div>
            </div>

            {/* Full file tree */}
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                overflowY: 'auto',
              }}
            >
              <Typography.Title
                level={5}
                style={{ margin: 0, marginBottom: 8, fontSize: 14 }}
              >
                {t('codeDiff.allFiles')}
              </Typography.Title>
              <Tree
                treeData={fileTree}
                selectedKeys={[selectedFile]}
                expandedKeys={expandedKeys}
                onSelect={handleFileSelect}
                onExpand={setExpandedKeys}
                showLine
                showIcon={false}
              />
            </div>
          </div>

          {/* Diff editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {selectedFile ? (
              <>
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Typography.Text strong>{selectedFile}</Typography.Text>
                  {modifiedFiles.includes(selectedFile) && (
                    <Typography.Text
                      type="warning"
                      style={{ marginLeft: 12, fontSize: 12 }}
                    >
                      • {t('codeDiff.modified')}
                    </Typography.Text>
                  )}
                  {!modifiedFiles.includes(selectedFile) && (
                    <Typography.Text
                      type="success"
                      style={{ marginLeft: 12, fontSize: 12 }}
                    >
                      • {t('codeDiff.unchanged')}
                    </Typography.Text>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {isVersion1Comparison ? (
                    // For version 1, compare with itself to show content without diff highlighting
                    <MonacoDiffEditor
                      key={`diff-${selectedFile}-v1`}
                      originalValue={currentContent}
                      modifiedValue={currentContent}
                      language={language}
                      readOnly={true}
                    />
                  ) : (
                    <MonacoDiffEditor
                      key={`diff-${selectedFile}-${comparisonMode.type}`}
                      originalValue={savedContent}
                      modifiedValue={currentContent}
                      language={language}
                      readOnly={true}
                    />
                  )}
                </div>
              </>
            ) : (
              <Flex
                justify="center"
                align="center"
                style={{ height: '100%', padding: 24 }}
              >
                <Empty description={t('codeDiff.selectFile')} />
              </Flex>
            )}
          </div>
        </Flex>
      )}
    </Modal>
  );
};

export default CodeDiffModal;

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CloseCircleFilled,
  FileOutlined,
  FolderOutlined,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Prisma } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Flex,
  Input,
  message,
  Modal,
  Spin,
  Tree,
  Typography,
} from 'antd';
import type { DataNode } from 'antd/es/tree';

import { ProjectAccessResponse } from '../../../../../../shared/types';
import { useAppModal } from '../../../../common/components/AppModal';
import PrototypeCodeEditor from '../../../../common/components/PrototypeCodeEditor';
import { translateStatusMessage } from '../../../../common/constants';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url } from '../../../../lib/constants';
import { getDocumentHistorySourceCodeApi } from '../../../documents/api/documentHistoryApi';
import { useOrganizationHierarchy } from '../../../organization/hooks/useOrganizationHierarchy';
import useUserProfileQuery from '../../../profile/hooks/useUserProfileQuery';
import { deployToVercel, startDevServer, stopDevServer, updateDevServerFiles } from '../../api/deployApi';
import useDocumentMutation from '../../hooks/useDocumentMutation';
import { compareFiles } from '../../utils/fileComparisonUtils';
import { PrototypeEditorToolbar } from './PrototypeEditorToolbar';
import { VisualEditPanel } from './VisualEditPanel';
import VercelLogsModal from './VercelLogsModal';

import './PrototypeEditor.scss';

function getLanguageFromFilename(
  filename: string
): 'tsx' | 'css' | 'md' | 'html' | 'json' | 'sql' {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
    case 'jsx':
    case 'js':
      return 'tsx';
    case 'css':
      return 'css';
    case 'md':
    case 'markdown':
      return 'md';
    case 'json':
      return 'json';
    case 'sql':
      return 'sql';
    case 'html':
    case 'htm':
      return 'html';
    default:
      return 'html'; // fallback
  }
}

export interface ProjectFile {
  path: string;
  content: string;
  type: 'file';
}

export interface FileComparisonResult {
  modifiedFiles: string[];
  hasChanges: boolean;
  currentMap: Map<string, string>;
  savedMap: Map<string, string>;
}

export interface PrototypeEditorProps {
  projectFiles: ProjectFile[];
  onError: (error: string) => void;
  docId: string;
  setSourceUrl: (sourceUrl: string) => void;
  sourceUrl: string;
  documentMeta: Prisma.JsonObject;
  isStreaming?: boolean;
  access?: ProjectAccessResponse;
  onFixErrorsClick: (chatContent: string) => void;
  onDeployRef?: (deployFn: () => Promise<void>) => void; // Callback to expose deploy function
  refetchDocument?: () => void; // Callback to refetch document after deployment
  onViewDiff?: () => void; // Callback to open diff view modal
  onGetCurrentFiles?: (getCurrentFilesFn: () => ProjectFile[]) => void; // Callback to expose current files (with user modifications)
  onFileComparisonChange?: (comparison: FileComparisonResult | null) => void; // Callback to expose file comparison result
  onToolbarRender?: (toolbar: React.ReactNode) => void; // Callback to expose toolbar for external rendering
  documentType?: string; // Document type (PROTOTYPE or PRODUCT)
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

// File tree node type
interface FileTreeNode extends DataNode {
  key: string;
  title: string;
  path: string;
  isLeaf?: boolean;
  children?: FileTreeNode[];
}

export function PrototypeEditor({
  projectFiles: initialProjectFiles,
  onError,
  docId,
  setSourceUrl,
  sourceUrl,
  documentMeta,
  isStreaming = false,
  access,
  onFixErrorsClick,
  onDeployRef,
  refetchDocument,
  onViewDiff,
  onGetCurrentFiles,
  onFileComparisonChange,
  onToolbarRender,
  documentType,
  onShare,
  onSaveStateChange,
  onVisualEditStateChange,
}: PrototypeEditorProps) {
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();
  const { user } = useCurrentUser();
  const { data: userProfile } = useUserProfileQuery(user.id);
  const { data: organization } = useOrganizationHierarchy();
  const isFetchingContent = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const lastReportedError = useRef<string | null>(null);
  const errorCount = useRef<number>(0);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
    'desktop'
  );

  const isReadOnly = access?.projectPermission === 'VIEW';

  // Add helper functions for view mode
  const isCodeView = () => viewMode === 'code';
  const isPreviewView = () => viewMode === 'preview';

  // Add states
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFileTree, setFilteredFileTree] = useState<FileTreeNode[]>([]);
  const isInitialMount = useRef(true);

  // Add state to manage project files
  const [projectFiles, setProjectFiles] =
    useState<ProjectFile[]>(initialProjectFiles);

  // Track modified files
  const [modifiedFiles, setModifiedFiles] = useState<Map<string, string>>(
    new Map()
  );

  // Change detection for save button
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Add error debouncing logic
  const lastErrorTime = useRef<number>(0);

  const [isUploadingToVercel, setIsUploadingToVercel] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string>('');
  const toolbarDisabled = false; // Default value, can be made configurable if needed
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Hot reload state
  const hotReloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const devServerUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingDevServerRef = useRef(false);
  const lastInlineUpdateRef = useRef<{ filePath: string; textContent: string; timestamp: number } | null>(null);
  const fileUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingFileUpdatesRef = useRef<ProjectFile[] | null>(null);
  const devServerUrlRef = useRef<string | null>(null);
  const [hotReloadReady, setHotReloadReady] = useState(false);

  // Visual Edit state
  const [visualEditEnabled, setVisualEditEnabled] = useState(false);
  const [visualEditReady, setVisualEditReady] = useState(false);
  const [isApplyingVisualEdit, setIsApplyingVisualEdit] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{
    filePath: string;
    lineNumber: number;
    columnNumber: number;
    elementName: string;
    tagName: string;
    textContent: string;
    className?: string;
    id?: string;
    inlineStyle?: string;
    computedStyles?: {
      color?: string;
      backgroundColor?: string;
      fontSize?: string;
      fontWeight?: string;
      fontFamily?: string;
      marginTop?: string;
      marginRight?: string;
      marginBottom?: string;
      marginLeft?: string;
      paddingTop?: string;
      paddingRight?: string;
      paddingBottom?: string;
      paddingLeft?: string;
      textAlign?: string;
      lineHeight?: string;
    };
  } | null>(null);

  // Dev server state for visual edit mode
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null);
  const [devServerStarting, setDevServerStarting] = useState(false);

  // Get deployment info from documentMeta
  // Support backward compatibility: fall back to old deploymentId field if new fields don't exist
  const previewDeploymentId =
    (documentMeta?.previewDeploymentId as string | undefined) ||
    (documentMeta?.deploymentId as string | undefined);
  const productionDeploymentId = documentMeta?.productionDeploymentId as
    | string
    | undefined;
  const deployDocId = documentMeta?.deployDocId as string | undefined;
  const productionUrl = documentMeta?.publishUrl as string | undefined;
  const previewUrl = (documentMeta?.sourceUrl as string) || sourceUrl;

  // Fetch saved files from document history (for code diff comparison)
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['documentHistorySourceCode', docId],
    queryFn: () => getDocumentHistorySourceCodeApi(docId),
    enabled: !!docId, // Only fetch when docId exists
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once on failure
  });

  const savedFiles = historyData?.sourceCode?.files || null;

  // Unified file comparison calculation (computed only once, used by both save button and diff modal)
  const fileComparison = useMemo(() => {
    // Get current files with modifications applied
    const currentFiles = projectFiles.map((file) => {
      if (file.path === selectedFile) {
        return { ...file, content: fileContent };
      }
      const modifiedContent = modifiedFiles.get(file.path);
      return modifiedContent !== undefined
        ? { ...file, content: modifiedContent }
        : file;
    });

    // Compare with saved files from document history
    // If savedFiles is not available yet (loading or error), assume no changes to avoid false positives
    if (!savedFiles && isLoadingHistory) {
      // Still loading, return no changes temporarily
      return {
        modifiedFiles: [],
        hasChanges: false,
        currentMap: new Map<string, string>(),
        savedMap: new Map<string, string>(),
      };
    }

    // Use shared comparison logic with actual saved files
    return compareFiles(currentFiles, savedFiles);
  }, [
    projectFiles,
    selectedFile,
    fileContent,
    modifiedFiles,
    savedFiles,
    isLoadingHistory,
  ]);

  // Expose file comparison result to parent component
  useEffect(() => {
    if (onFileComparisonChange) {
      onFileComparisonChange(fileComparison);
    }
  }, [fileComparison, onFileComparisonChange]);

  // Check if there are unsaved changes - now uses cached comparison result
  const checkForChanges = useCallback(() => {
    setHasUnsavedChanges(fileComparison.hasChanges);
  }, [fileComparison.hasChanges]);

  // Set deployUrl from documentMeta or sourceUrl prop
  useEffect(() => {
    const metaSourceUrl = documentMeta?.sourceUrl as string | undefined;
    const urlToUse = metaSourceUrl || sourceUrl;

    if (urlToUse && urlToUse !== deployUrl) {
      // Update deployUrl when source changes (from meta, prop, or refetch)
      setDeployUrl(urlToUse);
    }
  }, [documentMeta?.sourceUrl, sourceUrl, deployUrl]);

  // Close visual edit modal when deployUrl changes (after deployment completes)
  const prevDeployUrlRef = useRef<string>('');
  useEffect(() => {
    if (deployUrl && prevDeployUrlRef.current && deployUrl !== prevDeployUrlRef.current) {
      setSelectedElement(null);
    }
    prevDeployUrlRef.current = deployUrl;
  }, [deployUrl]);

  // Track the last loaded normalized URL to prevent unnecessary reloads
  const lastLoadedNormalizedUrlRef = useRef<string>('');
  
  // Normalize URLs for comparison (remove query params and trailing slashes)
  const normalizeUrl = useCallback((url: string) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.replace(/\/$/, '');
    } catch {
      return url.split('?')[0].split('#')[0].replace(/\/$/, '');
    }
  }, []);
  
  // Force iframe reload when deployUrl, sourceUrl, or devServerUrl changes
  // But only when the normalized URL actually changes (ignore query param changes)
  useEffect(() => {
    // Use dev server URL when visual edit is enabled, otherwise use deployed URL
    const urlToLoad = visualEditEnabled && devServerUrl ? devServerUrl : (deployUrl || sourceUrl);
    
    if (!urlToLoad) return;
    
    const normalizedUrlToLoad = normalizeUrl(urlToLoad);
    
    // Only reload if the normalized URL actually changed (base URL changed, not just query params)
    if (normalizedUrlToLoad !== lastLoadedNormalizedUrlRef.current && iframeRef.current) {
      lastLoadedNormalizedUrlRef.current = normalizedUrlToLoad;
      
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = urlToLoad;
        }
      }, 100);
      
      // Only reset ready states when URL actually changes
      setVisualEditReady(false);
      setHotReloadReady(false);
    }
  }, [deployUrl, sourceUrl, devServerUrl, visualEditEnabled, normalizeUrl]);

  const sendCodeUpdateToPreview = useCallback((filePath: string, content: string) => {
    // Don't send CODE_UPDATE messages in dev server mode - Vite HMR handles updates automatically
    if (visualEditEnabled && devServerUrl) {
      console.log('[HotReload] Skipping CODE_UPDATE - dev server mode, Vite HMR will handle updates');
      return;
    }
    
    if (!iframeRef.current?.contentWindow || !hotReloadReady) return;

    if (hotReloadTimeoutRef.current) {
      clearTimeout(hotReloadTimeoutRef.current);
    }

    hotReloadTimeoutRef.current = setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'CODE_UPDATE',
            filePath,
            content,
            timestamp: Date.now(),
          },
          '*'
        );
      }
    }, 300);
  }, [hotReloadReady, visualEditEnabled, devServerUrl]);

  // Helper function to search and replace text in file content (reused from VisualEditPanel logic)
  const searchAndReplaceText = useCallback((content: string, oldText: string, newText: string): { found: boolean; newContent: string } => {
    const normalizeWhitespace = (str: string): string => {
      return str.replace(/\s+/g, ' ').trim();
    };

    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const normalizedText = normalizeWhitespace(oldText);
    const normalizedReplacement = newText.trim();
    const escapedText = escapeRegex(oldText);
    const escapedNormalizedText = escapeRegex(normalizedText);

    // Strategy 1: JSX children - text between > and <
    const jsxChildrenPatterns = [
      new RegExp(`(>\\s*)${escapedText}(\\s*<)`, 'g'),
      new RegExp(`(>\\s*\\n\\s*)${escapedText}(\\s*\\n\\s*<)`, 'g'),
      new RegExp(`(>\\s*)${escapedNormalizedText.replace(/\\ /g, '\\s+')}(\\s*<)`, 'g'),
    ];

    for (const pattern of jsxChildrenPatterns) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const newContent = content.replace(pattern, (match, before, after) => {
          return before + normalizedReplacement + after;
        });
        return { found: true, newContent };
      }
    }

    // Strategy 2: String literals
    const stringLiteralPatterns = [
      new RegExp(`(")${escapedText}\\1`, 'g'),
      new RegExp(`(')${escapedText}\\1`, 'g'),
      new RegExp(`(\`)${escapedText}\\1`, 'g'),
    ];

    for (const pattern of stringLiteralPatterns) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const newContent = content.replace(pattern, (match, quote) => {
          return quote + normalizedReplacement + quote;
        });
        return { found: true, newContent };
      }
    }

    // Strategy 3: JSX with component tags
    const jsxTagPattern = new RegExp(`(<[^>]+>\\s*)${escapedText}(\\s*</[^>]+>)`, 'g');
    if (jsxTagPattern.test(content)) {
      jsxTagPattern.lastIndex = 0;
      const newContent = content.replace(jsxTagPattern, `$1${normalizedReplacement}$2`);
      return { found: true, newContent };
    }

    // Strategy 4: Template literals
    const templateLiteralPattern = new RegExp(`(\`[^\`]*?)\\${escapedText}([^\`]*?\`)`, 'g');
    if (templateLiteralPattern.test(content)) {
      templateLiteralPattern.lastIndex = 0;
      const newContent = content.replace(templateLiteralPattern, `$1${normalizedReplacement}$2`);
      return { found: true, newContent };
    }

    // Strategy 5: Whitespace-normalized search
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = normalizeWhitespace(lines[i]);
      if (normalizedLine.includes(normalizedText)) {
        const linePattern = new RegExp(escapeRegex(oldText).replace(/\\ /g, '\\s+'), 'g');
        if (linePattern.test(lines[i])) {
          linePattern.lastIndex = 0;
          lines[i] = lines[i].replace(linePattern, normalizedReplacement);
          return { found: true, newContent: lines.join('\n') };
        }
      }
    }

    // Strategy 6: Exact match fallback
    if (content.includes(oldText)) {
      const wordBoundaryPattern = new RegExp(`\\b${escapedText}\\b`, 'g');
      if (wordBoundaryPattern.test(content)) {
        wordBoundaryPattern.lastIndex = 0;
        return { found: true, newContent: content.replace(wordBoundaryPattern, normalizedReplacement) };
      }
      return { found: true, newContent: content.replace(oldText, normalizedReplacement) };
    }

    return { found: false, newContent: content };
  }, []);

  // Handle inline text updates from the preview
  const handleInlineTextUpdate = useCallback((elementInfo: any) => {
    const { filePath, textContent, originalText } = elementInfo;
    if (!filePath || !textContent || !originalText || textContent === originalText) {
      return;
    }

    // Prevent duplicate updates within 500ms
    const now = Date.now();
    const lastUpdate = lastInlineUpdateRef.current;
    if (lastUpdate && 
        lastUpdate.filePath === filePath && 
        lastUpdate.textContent === textContent &&
        now - lastUpdate.timestamp < 500) {
      console.log('[VisualEdit] Skipping duplicate update');
      return;
    }
    
    lastInlineUpdateRef.current = { filePath, textContent, timestamp: now };

    const file = projectFiles.find(f => f.path === filePath);
    let updatedFiles: ProjectFile[] | null = null;
    let changedFilePath: string | null = null;

    if (!file) {
      // Try searching in other files if it's a component file
      const isComponentFile = filePath.includes('/components/');
      if (isComponentFile) {
        const likelyFiles = projectFiles.filter(f => 
          f.path.includes('/pages/') || 
          f.path.includes('/app/') || 
          f.path.includes('index.tsx') || 
          f.path.includes('index.ts') ||
          f.path === 'src/pages/index.tsx' ||
          f.path === 'src/app/page.tsx'
        );

        for (const candidateFile of likelyFiles) {
          const result = searchAndReplaceText(candidateFile.content, originalText, textContent);
          if (result.found) {
            updatedFiles = projectFiles.map(f => 
              f.path === candidateFile.path 
                ? { ...f, content: result.newContent }
                : f
            );
            changedFilePath = candidateFile.path;
            break;
          }
        }

        // Search all files as last resort
        if (!updatedFiles) {
          for (const candidateFile of projectFiles) {
            const result = searchAndReplaceText(candidateFile.content, originalText, textContent);
            if (result.found) {
              updatedFiles = projectFiles.map(f => 
                f.path === candidateFile.path 
                  ? { ...f, content: result.newContent }
                  : f
              );
              changedFilePath = candidateFile.path;
              break;
            }
          }
        }
      }
      
      if (!updatedFiles) {
        message.warning('Could not find text to update');
        return;
      }
    } else {
      const result = searchAndReplaceText(file.content, originalText, textContent);
      if (result.found) {
        updatedFiles = projectFiles.map(f => 
          f.path === file.path 
            ? { ...f, content: result.newContent }
            : f
        );
        changedFilePath = file.path;
      } else {
        message.warning('Could not find text to update');
        return;
      }
    }

    if (updatedFiles && changedFilePath) {
      // Update project files
      setProjectFiles(updatedFiles);
      
      // Update modified files tracking
      const changedFile = updatedFiles.find(f => f.path === changedFilePath);
      if (changedFile) {
        setModifiedFiles(prev => new Map(prev).set(changedFile.path, changedFile.content));
        setSelectedFile(changedFile.path);
        setFileContent(changedFile.content);
      }
      
      // Update dev server files if running
      // Debounce file updates to allow Vite to batch changes and use HMR instead of reloading
      if (visualEditEnabled && devServerUrl) {
        setIsApplyingVisualEdit(true);
        
        // Store pending updates
        pendingFileUpdatesRef.current = updatedFiles;
        
        // Clear existing timeout
        if (fileUpdateTimeoutRef.current) {
          clearTimeout(fileUpdateTimeoutRef.current);
        }
        
        // Debounce file updates (500ms) to allow Vite to batch changes
        fileUpdateTimeoutRef.current = setTimeout(() => {
          const filesToUpdate = pendingFileUpdatesRef.current;
          if (!filesToUpdate) {
            setIsApplyingVisualEdit(false);
            return;
          }
          
          const timeoutId = setTimeout(() => {
            setIsApplyingVisualEdit(false);
          }, 30000);
          
          updateDevServerFiles(docId, filesToUpdate)
            .then(() => {
              clearTimeout(timeoutId);
              setIsApplyingVisualEdit(false);
              console.log('[VisualEdit] Files updated via Vite HMR');
            })
            .catch((error) => {
              console.error('[DevServer] Failed to update files:', error);
              clearTimeout(timeoutId);
              setIsApplyingVisualEdit(false);
            });
          
          (window as any).__visualEditTimeoutId = timeoutId;
          pendingFileUpdatesRef.current = null;
        }, 500); // 500ms debounce to batch rapid edits
      }
      
      // Trigger unsaved changes detection
      setHasUnsavedChanges(true);
      message.success('Text updated!');
    }
  }, [projectFiles, searchAndReplaceText, visualEditEnabled, devServerUrl, docId]);

  useEffect(() => {
    function handleVisualEditMessage(event: MessageEvent) {
      const { type, payload } = event.data || {};
      
      if (type === 'VISUAL_EDIT_READY') {
        console.log('[VisualEdit] Inspector ready in iframe');
        setVisualEditReady(true);
        setIsApplyingVisualEdit(false);
        if ((window as any).__visualEditTimeoutId) {
          clearTimeout((window as any).__visualEditTimeoutId);
          (window as any).__visualEditTimeoutId = null;
        }
        if (visualEditEnabled && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'VISUAL_EDIT_ENABLE' }, '*');
        }
      } else if (type === 'VISUAL_EDIT_SELECT' && payload) {
        console.log('[VisualEdit] Element selected:', payload);
        setSelectedElement(payload);
        message.info(`Selected: <${payload.tagName}> - Edit in the panel`);
      } else if (type === 'VISUAL_EDIT_TEXT_UPDATE' && payload) {
        console.log('[VisualEdit] Inline text update:', payload);
        handleInlineTextUpdate(payload);
        // Update selectedElement if it matches the edited element
        setSelectedElement((prev) => {
          if (!prev) return prev;
          // Match by filePath and lineNumber to identify the same element
          if (prev.filePath === payload.filePath && 
              prev.lineNumber === payload.lineNumber &&
              prev.columnNumber === payload.columnNumber) {
            return {
              ...prev,
              textContent: payload.textContent,
            };
          }
          return prev;
        });
      } else if (type === 'HOT_RELOAD_READY') {
        console.log('[HotReload] Hot reload ready in iframe');
        setHotReloadReady(true);
        if (visualEditEnabled) {
          setIsApplyingVisualEdit(false);
          if ((window as any).__visualEditTimeoutId) {
            clearTimeout((window as any).__visualEditTimeoutId);
            (window as any).__visualEditTimeoutId = null;
          }
        }
      }
    }

    window.addEventListener('message', handleVisualEditMessage);
    return () => window.removeEventListener('message', handleVisualEditMessage);
  }, [visualEditEnabled, handleInlineTextUpdate]);

  // Visual Edit: Start/stop dev server when visual edit mode is toggled
  useEffect(() => {
    if (visualEditEnabled && !devServerUrl && !devServerStarting) {
      setDevServerStarting(true);
      startDevServer(docId)
        .then((result) => {
          if (result.success && result.url) {
            // Wait a bit longer for Vite to be fully ready before updating files
            // This helps avoid 504 errors from outdated requests
            setTimeout(() => {
              const currentFiles = projectFiles.map((file) => {
                if (file.path === selectedFile) {
                  return { ...file, content: fileContent };
                }
                const modifiedContent = modifiedFiles.get(file.path);
                return modifiedContent !== undefined
                  ? { ...file, content: modifiedContent }
                  : file;
              });
              
              updateDevServerFiles(docId, currentFiles)
                .then(() => {
                  // Wait for file updates to complete before setting URL
                  // Add cache-busting parameter to force fresh load
                  const urlWithTimestamp = `${result.url}?t=${Date.now()}`;
                  setDevServerUrl(urlWithTimestamp);
                  setDevServerStarting(false);
                  console.log('[DevServer] Started dev server:', urlWithTimestamp);
                })
                .catch((error) => {
                  console.error('[DevServer] Failed to update files after start:', error);
                  // Still set the URL even if file update fails
                  const urlWithTimestamp = `${result.url}?t=${Date.now()}`;
                  setDevServerUrl(urlWithTimestamp);
                  setDevServerStarting(false);
                });
            }, 3000); // Increased delay to 3 seconds to ensure Vite is ready
          } else {
            console.error('[DevServer] Failed to start dev server:', result.error);
            setDevServerStarting(false);
            message.error('Failed to start dev server. Using deployed preview.');
          }
        })
        .catch((error) => {
          console.error('[DevServer] Error starting dev server:', error);
          setDevServerStarting(false);
          message.error('Failed to start dev server. Using deployed preview.');
        });
    } else if (!visualEditEnabled && devServerUrl && !isStoppingDevServerRef.current) {
      isStoppingDevServerRef.current = true;
      // Clear any pending file updates when disabling visual edit
      if (fileUpdateTimeoutRef.current) {
        clearTimeout(fileUpdateTimeoutRef.current);
        fileUpdateTimeoutRef.current = null;
      }
      pendingFileUpdatesRef.current = null;
      
      stopDevServer(docId).then((result) => {
        if (result.success) {
          console.log('[DevServer] Stopped dev server');
        }
        setDevServerUrl(null);
        isStoppingDevServerRef.current = false;
      }).catch((error) => {
        console.error('[DevServer] Error stopping dev server:', error);
        isStoppingDevServerRef.current = false;
      });
    }

    return () => {
      if (devServerUpdateTimeoutRef.current) {
        clearTimeout(devServerUpdateTimeoutRef.current);
      }
      if (fileUpdateTimeoutRef.current) {
        clearTimeout(fileUpdateTimeoutRef.current);
      }
    };
  }, [visualEditEnabled, docId, devServerUrl, devServerStarting]);

  useEffect(() => {
    devServerUrlRef.current = devServerUrl;
  }, [devServerUrl]);

  useEffect(() => {
    return () => {
      if (devServerUrlRef.current && !isStoppingDevServerRef.current) {
        isStoppingDevServerRef.current = true;
        stopDevServer(docId).catch((error) => {
          console.error('[DevServer] Error stopping dev server on unmount:', error);
        }).finally(() => {
          isStoppingDevServerRef.current = false;
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Visual Edit: Toggle enabled state
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: visualEditEnabled ? 'VISUAL_EDIT_ENABLE' : 'VISUAL_EDIT_DISABLE' },
        '*'
      );
    }
  }, [visualEditEnabled]);

  // Visual Edit: Expose state to parent
  useEffect(() => {
    if (onVisualEditStateChange) {
      onVisualEditStateChange({
        enabled: visualEditEnabled,
        ready: visualEditReady,
        onToggle: setVisualEditEnabled,
      });
    }
  }, [visualEditEnabled, visualEditReady, onVisualEditStateChange]);

  // Visual Edit: Handle saving changes from the panel
  const handleVisualEditSave = useCallback((updatedFiles: ProjectFile[]) => {
    setProjectFiles(updatedFiles);
    
    // Find the changed file and update modified files tracking
    if (selectedElement) {
      const changedFile = updatedFiles.find(f => f.path === selectedElement.filePath);
      if (changedFile) {
        setModifiedFiles(prev => new Map(prev).set(changedFile.path, changedFile.content));
        setSelectedFile(changedFile.path);
        setFileContent(changedFile.content);
      }
    }
    
    // Update dev server files if running
    // Vite HMR will automatically handle the updates without reloading
    if (visualEditEnabled && devServerUrl) {
      setIsApplyingVisualEdit(true);
      
      const timeoutId = setTimeout(() => {
        setIsApplyingVisualEdit(false);
      }, 30000);
      
      updateDevServerFiles(docId, updatedFiles)
        .then(() => {
          // Files updated - Vite HMR will automatically update the preview
          // No need to reload the iframe
          clearTimeout(timeoutId);
          setIsApplyingVisualEdit(false);
        })
        .catch((error) => {
          console.error('[DevServer] Failed to update files:', error);
          clearTimeout(timeoutId);
          setIsApplyingVisualEdit(false);
        });
      
      (window as any).__visualEditTimeoutId = timeoutId;
    }
    
    // Trigger unsaved changes detection
    setHasUnsavedChanges(true);
  }, [selectedElement, visualEditEnabled, devServerUrl, docId]);

  // Visual Edit: Close panel (only closes panel, keeps visual edit enabled)
  const handleVisualEditClose = useCallback(() => {
    setSelectedElement(null);
  }, []);

  // Add useEffect to update projectFiles when initialProjectFiles changes
  // Only trigger when initialProjectFiles actually changes (e.g., document refetch)
  // Don't trigger on user edits to selectedFile/fileContent
  useEffect(() => {
    const currentFilesStr = JSON.stringify(projectFiles);
    const newFilesStr = JSON.stringify(initialProjectFiles);

    if (currentFilesStr !== newFilesStr) {
      setProjectFiles(initialProjectFiles);

      // Clear modified files tracking when loading new version
      setModifiedFiles(new Map());

      // Try to find and open package.json
      const packageJsonFile = initialProjectFiles.find(
        (file) => file.path === 'package.json'
      );

      if (packageJsonFile) {
        setSelectedFile('package.json');
        setFileContent(packageJsonFile.content);
      } else {
        // If no package.json, don't select any file
        setSelectedFile('');
        setFileContent('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectFiles]);

  // Add useEffect to handle initial package.json opening
  useEffect(() => {
    if (initialProjectFiles.length > 0) {
      const packageJsonFile = initialProjectFiles.find(
        (file) => file.path === 'package.json'
      );

      if (packageJsonFile) {
        setSelectedFile('package.json');
        setFileContent(packageJsonFile.content);
      }
    }
  }, [initialProjectFiles]); // Empty dependency array means this runs once on mount

  // Check for changes whenever file content or modified files change
  useEffect(() => {
    checkForChanges();
  }, [fileContent, modifiedFiles, checkForChanges]);

  const { upsertDocumentMutation, resetDocumentMutation } = useDocumentMutation(
    {
      onSuccess: (doc) => {
        console.log('upsertDocumentMutation.success');
        isFetchingContent.current = false;
      },
      onError: () => {
        console.error('error');
        isFetchingContent.current = false;
      },
    }
  );

  // Update file trees when project files change

  // Handle source file selection
  const handleSourceFileSelect = async (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) {
      setSelectedFile('');
      return;
    }

    const path = selectedKeys[0] as string;
    const file = projectFiles.find((f) => f.path === path);

    if (file && file.path !== selectedFile) {
      setSelectedFile(path);
      // Check if the new file has been modified, otherwise use the original content
      const modifiedContent = modifiedFiles.get(path);
      setFileContent(
        modifiedContent !== undefined ? modifiedContent : file.content
      );
    }
  };

  const messageKey = 'deploymentStatus';

  // Reset error state when switching to preview mode
  useEffect(() => {
    if (viewMode === 'preview') {
      lastReportedError.current = null;
      errorCount.current = 0;
      lastErrorTime.current = 0;
      setError(null);
      
      // Send all modified files to preview when switching to preview mode
      if (hotReloadReady && modifiedFiles.size > 0) {
        modifiedFiles.forEach((content, filePath) => {
          sendCodeUpdateToPreview(filePath, content);
        });
      }
    }
  }, [viewMode, hotReloadReady, modifiedFiles, sendCodeUpdateToPreview]);

  // Perform the actual deployment
  const performDeployment = useCallback(async () => {
    if (!docId) {
      message.error(t('message.documentIdRequiredSaving'));
      return;
    }

    try {
      setIsEditing(true);
      setStatus('loading');

      // Prefer latest files injected from settings flow (to avoid stale overwrite)
      const globalLatest = (window as any)?.__LATEST_FILES_FOR_REDEPLOY__;
      const baseFiles: ProjectFile[] = Array.isArray(globalLatest)
        ? (globalLatest as ProjectFile[])
        : projectFiles;

      // Create new array with all modified files, including the currently selected file
      const updatedFiles = baseFiles.map((file) => {
        // First check if this is the currently selected file
        if (file.path === selectedFile) {
          return { ...file, content: fileContent };
        }
        // Then check if this file has been modified previously
        const modifiedContent = modifiedFiles.get(file.path);
        return modifiedContent !== undefined
          ? { ...file, content: modifiedContent }
          : file;
      });

      // Clear the injected snapshot once consumed
      if (Array.isArray(globalLatest)) {
        try {
          (window as any).__LATEST_FILES_FOR_REDEPLOY__ = undefined;
        } catch {}
      }

      // Update local state first
      setProjectFiles(updatedFiles);

      // Clear modified files tracking after save
      setModifiedFiles(new Map());

      const modifiedCount = modifiedFiles.size;
      const loadingMessage =
        modifiedCount > 0
          ? `${t('prototypeEditor.savingChanges')} (${modifiedCount} file${
              modifiedCount > 1 ? 's' : ''
            })`
          : t('deploying.app');
      message.loading({
        content: loadingMessage,
        key: messageKey,
        duration: 0,
      });

      // Save to backend first
      await upsertDocumentMutation.mutateAsync({
        id: docId,
        contentStr: JSON.stringify({ files: updatedFiles }),
      });

      // Start streaming deployment
      const headers = await getHeaders();
      const response = await fetch(
        `${api_url}/api/deploy/deployToVercel-streaming`,
        {
          method: 'POST',
          headers: {
            ...headers,
            Accept: 'text/event-stream',
          },
          credentials: 'include',
          body: JSON.stringify({
            documentId: docId,
            files: updatedFiles,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Network Error, please try again.');
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let deploymentComplete = false;
      let hasReceivedData = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (separated by \n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete chunk for next iteration

        for (const line of lines) {
          if (!line.trim() || deploymentComplete) continue;

          // Skip keep-alive pings
          if (line.trim() === ': ping' || line.startsWith(':')) {
            continue;
          }

          try {
            const parsed = JSON.parse(line);
            hasReceivedData = true;

            // Handle source URL update FIRST - this indicates successful deployment
            // Process this before status messages to ensure immediate UI update
            if (parsed.sourceUrl) {
              // Update local deployUrl state immediately to hide spinner
              setDeployUrl(parsed.sourceUrl);
              setSourceUrl(parsed.sourceUrl);
              // Set status to ready and switch to preview mode (not code view)
              setStatus('ready');
              setIsEditing(false);
              // Force switch to preview mode after deployment completes
              setViewMode('preview');
              // Close visual edit modal when deployment completes
              setSelectedElement(null);

              message.success({
                content: 'Deployment successful.',
                key: messageKey,
                duration: 1,
              });

              // Create document history only if there are code changes
              if (fileComparison.hasChanges) {
                try {
                  const headers = await getHeaders();
                  const historyResponse = await fetch(
                    `${api_url}/api/documents/${docId}/history`,
                    {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({
                        description: 'Manual save',
                        sourceUrl: parsed.sourceUrl,
                      }),
                    }
                  );
                  const historyResult = await historyResponse.json();

                  if (historyResult.success && historyResult.data) {
                    const newVersionNumber = historyResult.data.versionNumber;

                    // Update document meta to set active history version
                    await upsertDocumentMutation.mutateAsync({
                      id: docId,
                      meta: {
                        ...documentMeta,
                        sourceUrl: parsed.sourceUrl,
                        activeHistoryVersion: newVersionNumber,
                      },
                    });
                  }
                } catch (historyError) {
                  console.error(
                    'Failed to create document history:',
                    historyError
                  );
                  // Don't show error to user - history creation is not critical
                }
              } else {
                console.log(
                  '⏭️ Skipping document history creation - no code changes detected'
                );
                // Still update sourceUrl in meta even without code changes
                try {
                  await upsertDocumentMutation.mutateAsync({
                    id: docId,
                    meta: {
                      ...documentMeta,
                      sourceUrl: parsed.sourceUrl,
                    },
                  });
                } catch (metaError) {
                  console.error('Failed to update sourceUrl:', metaError);
                }
              }

              // Mark deployment as complete and break out of all loops
              deploymentComplete = true;
              break;
            }

            // Handle status updates
            if (parsed.status?.message) {
              const statusMessage = translateStatusMessage(
                parsed.status.message,
                t
              );
              message.loading({
                content: statusMessage,
                key: messageKey,
                duration: 0,
              });

              // When deployment is complete, refetch document to get latest sourceUrl
              // (This is a fallback if sourceUrl wasn't in the same message)
              if (
                (statusMessage === 'Deployment complete' ||
                  parsed.status.message === 'Deployment complete') &&
                !deploymentComplete
              ) {
                if (refetchDocument) {
                  // Small delay to ensure backend has updated the document
                  setTimeout(async () => {
                    refetchDocument();
                    message.success({
                      content: 'Deployment successful.',
                      key: messageKey,
                      duration: 1,
                    });
                    // Switch to preview mode after refetch (not code view)
                    setStatus('ready');
                    setIsEditing(false);
                    // Force switch to preview mode after deployment completes
                    setViewMode('preview');
                  }, 500);
                  deploymentComplete = true;
                }
              }
            }

            // Handle errors
            if (parsed.error) {
              const errorMessage = parsed.error;
              message.error({
                content:
                  'Deployment failed, please fix the errors and try again.',
                key: messageKey,
                duration: 1,
              });
              setError(errorMessage);
              throw new Error(errorMessage);
            }
          } catch (error) {
            // If JSON parsing fails, it might be a keepalive or other non-JSON line
            if (error instanceof SyntaxError) {
              console.log('Non-JSON line (possibly keepalive):', line);
            } else {
              console.error('Error processing deployment update:', error);
            }
          }
        }
      }

      // If stream ended but we didn't get a completion signal, check if we received any data
      if (!deploymentComplete && hasReceivedData) {
        // Stream ended but we got some data - deployment might have succeeded
        // Refetch document to get latest sourceUrl
        if (refetchDocument) {
          setTimeout(async () => {
            refetchDocument();
            message.success({
              content: 'Deployment successful.',
              key: messageKey,
              duration: 1,
            });
            setStatus('ready');
            setIsEditing(false);
            setViewMode('preview');
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error saving file:', err);
      message.error(t('message.failedToSaveFileEditor'));
      onError?.(err instanceof Error ? err.message : 'Failed to save file');
      setError(err instanceof Error ? err.message : 'Failed to save file');
      message.error({
        content: 'Failed to save file',
        key: messageKey,
        duration: 1,
      });
      // setStatus('error');
    } finally {
      setIsEditing(false);
    }
  }, [
    docId,
    projectFiles,
    modifiedFiles,
    selectedFile,
    fileContent,
    upsertDocumentMutation,
    refetchDocument,
    setSourceUrl,
    onError,
    t,
    fileComparison,
    documentMeta,
  ]);

  // Modify handleSave function - shows confirmation modal before deployment
  const handleSave = useCallback(async () => {
    if (!docId) {
      message.error(t('message.documentIdRequiredSaving'));
      return;
    }

    // Check if this is a product that can be published (has productionUrl)
    const isProduct = !!productionUrl;

    // Show confirmation modal before deployment
    Modal.confirm({
      title: t('prototypeEditor.confirmDeployment'),
      content: (
        <div>
          <p>{t('prototypeEditor.deploymentMayTakeTime')}</p>
          {isProduct && (
            <p style={{ marginTop: 8, fontWeight: 500 }}>
              {t('prototypeEditor.rememberToPublish')}
            </p>
          )}
        </div>
      ),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        await performDeployment();
      },
    });
  }, [docId, productionUrl, t, performDeployment]);

  // Expose handleSave function to parent via callback ref
  useEffect(() => {
    if (onDeployRef) {
      onDeployRef(handleSave);
    }
  }, [onDeployRef, handleSave]);

  // Expose getCurrentFiles function to parent to get real-time file state with user modifications
  useEffect(() => {
    if (onGetCurrentFiles) {
      onGetCurrentFiles(() => {
        // Return current files with all modifications applied
        return projectFiles.map((file) => {
          // Check if this is the currently selected file (has unsaved changes in editor)
          if (file.path === selectedFile) {
            return { ...file, content: fileContent };
          }
          // Check if this file has been modified previously (stored in modifiedFiles map)
          const modifiedContent = modifiedFiles.get(file.path);
          return modifiedContent !== undefined
            ? { ...file, content: modifiedContent }
            : file;
        });
      });
    }
  }, [
    onGetCurrentFiles,
    projectFiles,
    selectedFile,
    fileContent,
    modifiedFiles,
  ]);

  // Expose save button state for DocumentToolbar
  useEffect(() => {
    if (onSaveStateChange) {
      onSaveStateChange({
        onSave: handleSave,
        hasUnsavedChanges,
        isEditing,
        hasFiles: projectFiles.length > 0,
        isReadOnly,
      });
    }
    return () => {
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
    onSaveStateChange,
    handleSave,
    hasUnsavedChanges,
    isEditing,
    projectFiles,
    isReadOnly,
  ]);

  // Expose toolbar for external rendering
  useEffect(() => {
    if (onToolbarRender) {
      const toolbar = (
        <PrototypeEditorToolbar
          viewMode={viewMode}
          previewMode={previewMode}
          isReadOnly={isReadOnly}
          hasUnsavedChanges={hasUnsavedChanges}
          isEditing={isEditing}
          access={access}
          docId={docId}
          deployUrl={deployUrl}
          previewDeploymentId={previewDeploymentId}
          productionDeploymentId={productionDeploymentId}
          productionUrl={productionUrl}
          previewUrl={previewUrl}
          onViewModeChange={setViewMode}
          onPreviewModeChange={setPreviewMode}
          onSave={handleSave}
          onViewDiff={onViewDiff}
          onViewLogs={() => setShowLogsModal(true)}
          onShare={onShare}
          hasFiles={true}
        />
      );
      onToolbarRender(toolbar);
    }
    // Cleanup: clear toolbar when component unmounts or when onToolbarRender changes
    return () => {
      if (onToolbarRender) {
        onToolbarRender(null);
      }
    };
  }, [
    // Don't include onToolbarRender in dependencies to avoid infinite loops
    // It's a stable function reference from parent
    viewMode,
    previewMode,
    isReadOnly,
    hasUnsavedChanges,
    isEditing,
    access,
    docId,
    deployUrl,
    previewDeploymentId,
    productionDeploymentId,
    productionUrl,
    previewUrl,
    onViewDiff,
    handleSave,
    onShare,
  ]);

  // Add useEffect to build file tree when projectFiles changes
  useEffect(() => {
    if (isStreaming) {
      return;
    }

    const buildFileTree = (files: ProjectFile[]): FileTreeNode[] => {
      const tree: FileTreeNode[] = [];
      const fileMap = new Map<string, FileTreeNode>();

      files.forEach((file) => {
        const parts = file.path.split('/');
        let currentPath = '';

        parts.forEach((part, index) => {
          currentPath = index === 0 ? part : `${currentPath}/${part}`;

          if (!fileMap.has(currentPath)) {
            const isModified = modifiedFiles.has(currentPath);
            const isLeaf = index === parts.length - 1;
            const displayTitle = isModified ? `${part} •` : part;

            // Use FileOutlined for files, no icon for folders (switcher handles folders)
            const node: FileTreeNode = {
              key: currentPath,
              title: displayTitle,
              path: currentPath,
              isLeaf: isLeaf,
              icon: isLeaf ? (
                <FileOutlined style={{ color: '#595959', fontSize: 14 }} />
              ) : null,
              children: [],
            };

            if (index === 0) {
              tree.push(node);
            } else {
              const parentPath = currentPath.substring(
                0,
                currentPath.lastIndexOf('/')
              );
              const parent = fileMap.get(parentPath);
              if (parent && parent.children) {
                parent.children.push(node);
              }
            }

            fileMap.set(currentPath, node);
          }
        });
      });

      // Sort function: folders first, then files, alphabetically within each group
      const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes
          .sort((a, b) => {
            // Folders (non-leaf) come before files (leaf)
            if (!a.isLeaf && b.isLeaf) return -1;
            if (a.isLeaf && !b.isLeaf) return 1;

            // Within the same type, sort alphabetically by title
            const titleA =
              typeof a.title === 'string' ? a.title : String(a.title);
            const titleB =
              typeof b.title === 'string' ? b.title : String(b.title);
            return titleA.localeCompare(titleB, undefined, {
              sensitivity: 'base',
            });
          })
          .map((node) => ({
            ...node,
            children: node.children ? sortNodes(node.children) : [],
          }));
      };

      const sortedTree = sortNodes(tree);
      return sortedTree;
    };

    const newFileTree = buildFileTree(projectFiles);
    setFileTree(newFileTree);

    // Only reset expanded keys on initial mount, not on every modifiedFiles change
    if (isInitialMount.current) {
      setExpandedKeys([]);
      isInitialMount.current = false;
    }
  }, [projectFiles, isStreaming, modifiedFiles]);

  // Initialize filtered tree
  useEffect(() => {
    setFilteredFileTree(fileTree);
  }, [fileTree]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFileTree(fileTree);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matchedPaths = new Set<string>();

    // Search in file names and content
    projectFiles.forEach((file) => {
      const filePathLower = file.path.toLowerCase();
      const fileContentLower = file.content.toLowerCase();

      // Check if file path or content matches
      if (filePathLower.includes(query) || fileContentLower.includes(query)) {
        matchedPaths.add(file.path);

        // Add all parent paths
        const parts = file.path.split('/');
        let parentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          parentPath = i === 0 ? parts[i] : `${parentPath}/${parts[i]}`;
          matchedPaths.add(parentPath);
        }
      }
    });

    // Filter tree to only include matched paths
    const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes
        .filter((node) => matchedPaths.has(node.path))
        .map((node) => ({
          ...node,
          children: node.children ? filterTree(node.children) : [],
        }));
    };

    const filtered = filterTree(fileTree);
    setFilteredFileTree(filtered);

    // Auto-expand all matched nodes
    setExpandedKeys(Array.from(matchedPaths));
  }, [searchQuery, fileTree, projectFiles]);

  const handleUploadToVercel = async (updatedFiles: ProjectFile[]) => {
    if (!docId || !updatedFiles) {
      return {
        sourceUrl: '',
        success: false,
        errorMessage: 'Deployment failed',
      };
    }

    if (isUploadingToVercel) {
      return {
        sourceUrl: '',
        success: false,
        errorMessage: 'Deployment failed',
      };
    }

    setIsUploadingToVercel(true);
    setStatus('loading');

    try {
      const result = await deployToVercel(docId, updatedFiles);

      console.log('new deployToVercel result', result);

      return result;
    } catch (error) {
      console.error('Vercel deployment failed:', error);
      setStatus('error');
      return {
        sourceUrl: '',
        success: false,
        errorMessage: 'Deployment failed',
      };
    } finally {
      setIsUploadingToVercel(false);
    }
  };

  return (
    <Flex
      vertical
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)', // Hack to remove extra toolbar height
        width: '100%',
      }}
    >
      {/* Top button bar - hidden when toolbar is rendered externally */}
      {!onToolbarRender && (
        <Flex
          style={{
            padding: '6px 12px',
            borderTop: '1px solid #e8e8e8',
            borderBottom: '1px solid #e8e8e8',
            backgroundColor: '#fff',
            minHeight: 0,
            height: '44px',
          }}
        >
          <Flex
            align="center"
            justify="space-between"
            style={{ width: '100%' }}
          >
            <PrototypeEditorToolbar
              viewMode={viewMode}
              previewMode={previewMode}
              isReadOnly={isReadOnly}
              hasUnsavedChanges={hasUnsavedChanges}
              isEditing={isEditing}
              access={access}
              docId={docId}
              deployUrl={deployUrl}
              previewDeploymentId={previewDeploymentId}
              productionDeploymentId={productionDeploymentId}
              productionUrl={productionUrl}
              previewUrl={previewUrl}
              onViewModeChange={setViewMode}
              onPreviewModeChange={setPreviewMode}
              onSave={handleSave}
              onViewDiff={onViewDiff}
              onViewLogs={() => setShowLogsModal(true)}
            />
          </Flex>
        </Flex>
      )}

      {/* Bottom content area */}
      <Flex
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {isCodeView() ? (
          <>
            {/* Left file tree */}
            {!isStreaming && (
              <Flex
                vertical
                style={{
                  width: '200px',
                  minWidth: '200px',
                  borderRight: '1px solid #e8e8e8',
                  overflow: 'hidden',
                  flex: 'none',
                  height: '100%',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* Header with Files title and Search */}
                <Flex
                  vertical
                  style={{
                    borderBottom: '1px solid #e8e8e8',
                    padding: '12px 16px 8px',
                  }}
                >
                  <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                    <FolderOutlined
                      style={{ fontSize: 18, color: '#262626' }}
                    />
                    <Typography.Text
                      strong
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#262626',
                      }}
                    >
                      Files
                    </Typography.Text>
                  </Flex>
                  <Input
                    placeholder="Search files..."
                    prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                    suffix={
                      searchQuery ? (
                        <CloseCircleFilled
                          style={{ color: '#8c8c8c', cursor: 'pointer' }}
                          onClick={() => setSearchQuery('')}
                        />
                      ) : null
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      fontSize: 13,
                      borderRadius: 4,
                    }}
                    size="small"
                  />
                </Flex>

                {/* File tree */}
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '4px 0',
                  }}
                >
                  {filteredFileTree.length > 0 ? (
                    <Tree
                      treeData={filteredFileTree}
                      onSelect={handleSourceFileSelect}
                      selectedKeys={selectedFile ? [selectedFile] : []}
                      expandedKeys={expandedKeys}
                      onExpand={(newExpandedKeys) =>
                        setExpandedKeys(newExpandedKeys)
                      }
                      showIcon={true}
                      showLine={false}
                      blockNode={true}
                      className="prototype-file-tree"
                      style={{
                        background: 'transparent',
                        fontSize: 14,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#8c8c8c',
                        fontSize: 13,
                      }}
                    >
                      {searchQuery ? 'No files found' : 'No files'}
                    </div>
                  )}
                </div>
              </Flex>
            )}

            {/* Right editor */}
            <Flex
              vertical
              style={{
                flex: 1,
                minWidth: 0,
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
                height: '100%',
              }}
            >
              <Flex
                vertical
                style={{
                  height: '100%',
                  minHeight: 0,
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                <Flex
                  justify="space-between"
                  align="center"
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #e8e8e8',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {selectedFile !== ''
                      ? `Editor - ${selectedFile}`
                      : t('prototypeEditor.editor')}
                  </Typography.Text>
                </Flex>
                {error && (
                  <Alert
                    message={t('common.error')}
                    description={
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
                        <div style={{ marginTop: 12 }}>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                              const errorPrompt = t(
                                'prototypeEditor.deploymentFailed'
                              ).replace('{error}', error);
                              console.log(errorPrompt);
                              onFixErrorsClick?.(errorPrompt);
                            }}
                          >
                            {t('prototypeEditor.fixErrors')}
                          </Button>
                        </div>
                      </div>
                    }
                    type="error"
                    showIcon
                    style={{ margin: '8px' }}
                  />
                )}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <PrototypeCodeEditor
                    key={selectedFile}
                    value={fileContent}
                    onUpdate={(content) => {
                      if (content !== fileContent) {
                        setFileContent(content || '');
                        // Track this file as modified
                        setModifiedFiles((prev) => {
                          const newMap = new Map(prev);
                          newMap.set(selectedFile, content || '');
                          return newMap;
                        });
                        // Send code update to preview iframe for hot reload
                        if (selectedFile && viewMode === 'preview') {
                          sendCodeUpdateToPreview(selectedFile, content || '');
                        }
                        
                        // Update dev server files if visual edit is enabled
                        if (visualEditEnabled && devServerUrl && selectedFile) {
                          if (devServerUpdateTimeoutRef.current) {
                            clearTimeout(devServerUpdateTimeoutRef.current);
                          }
                          
                          // Debounce file updates to avoid too many writes
                          devServerUpdateTimeoutRef.current = setTimeout(() => {
                            const currentFiles = projectFiles.map((file) => {
                              if (file.path === selectedFile) {
                                return { ...file, content: content || '' };
                              }
                              const modifiedContent = modifiedFiles.get(file.path);
                              return modifiedContent !== undefined
                                ? { ...file, content: modifiedContent }
                                : file;
                            });
                            updateDevServerFiles(docId, currentFiles).catch((error) => {
                              console.error('[DevServer] Failed to update files:', error);
                            });
                          }, 3000); // Wait 3 second after last change
                        }
                      }
                    }}
                    editable={access?.projectPermission === 'EDIT'}
                    language={getLanguageFromFilename(selectedFile)}
                    style={{
                      height: '100%',
                      width: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                </div>
              </Flex>
            </Flex>
          </>
        ) : (
          // Preview mode
          <Flex
            vertical
            style={{
              width: '100%',
              padding: 0,
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                width: previewMode === 'mobile' ? '375px' : '100%',
                transition: 'width 0.3s ease-in-out',
              }}
            >
              {status === 'loading' &&
                !error &&
                sourceUrl === '' &&
                deployUrl === '' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#f5f5f5',
                      zIndex: 10,
                      gap: '16px',
                    }}
                  >
                    <Spin
                      indicator={
                        <LoadingOutlined style={{ fontSize: 24 }} spin />
                      }
                      tip={t('prototypeEditor.buildingAppPreview')}
                    />
                    <Typography.Text type="secondary">
                      {t('prototypeEditor.pleaseWaitPreview')}
                    </Typography.Text>
                  </div>
                )}

              {status === 'error' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f5f5f5',
                    zIndex: 10,
                    gap: '16px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {t('prototypeEditor.networkIssue')}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {t('prototypeEditor.somethingWentWrong')}
                  </Typography.Text>
                </div>
              )}

              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: deployUrl || sourceUrl ? 'block' : 'none',
                  backgroundColor: '#fff',
                }}
              >
                <iframe
                  key={(() => {
                    // Use normalized URL for key to prevent remounting when only query params change
                    const urlToUse = visualEditEnabled && devServerUrl ? devServerUrl : (deployUrl || sourceUrl || '');
                    if (!urlToUse) return 'empty';
                    try {
                      const urlObj = new URL(urlToUse);
                      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
                    } catch {
                      return urlToUse.split('?')[0].split('#')[0];
                    }
                  })()}
                  ref={iframeRef}
                  title={t('prototypeEditor.preview')}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#fff',
                  }}
                  src={visualEditEnabled && devServerUrl ? devServerUrl : (deployUrl || sourceUrl || '')}
                  sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-popups-to-escape-sandbox allow-presentation"
                  referrerPolicy="no-referrer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                
                {/* Loading overlay when starting dev server */}
                {devServerStarting && visualEditEnabled && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      zIndex: 20,
                      gap: '16px',
                    }}
                  >
                    <Spin
                      indicator={
                        <LoadingOutlined style={{ fontSize: 24 }} spin />
                      }
                      tip={t('prototypeEditor.startingLivePreview')}
                    />
                    <Typography.Text type="secondary">{t('prototypeEditor.startingLivePreview')}</Typography.Text>
                  </div>
                )}
                
                {/* Loading overlay when applying visual edit changes */}
                {isApplyingVisualEdit && visualEditEnabled && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      zIndex: 20,
                      gap: '16px',
                    }}
                  >
                    <Spin
                      indicator={
                        <LoadingOutlined style={{ fontSize: 24 }} spin />
                      }
                      tip={t('prototypeEditor.visualEditPreview')}
                    />
                    <Typography.Text type="secondary">{t('prototypeEditor.visualEditPreview')}</Typography.Text>
                  </div>
                )}
              </div>

              {/* Visual Edit Panel - Only show when element is selected */}
              {visualEditEnabled && selectedElement && (
                <VisualEditPanel
                  selectedElement={selectedElement}
                  projectFiles={projectFiles}
                  onClose={handleVisualEditClose}
                  onSave={handleVisualEditSave}
                  onDeploy={handleSave}
                />
              )}
            </div>
          </Flex>
        )}
      </Flex>

      {/* Vercel Logs Modal */}
      <VercelLogsModal
        visible={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        previewDeploymentId={previewDeploymentId}
        productionDeploymentId={productionDeploymentId}
        projectId={deployDocId}
        productionUrl={productionUrl}
        previewUrl={previewUrl}
        documentType={documentType}
      />
    </Flex>
  );
}

export default PrototypeEditor;

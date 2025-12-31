import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import {
  ChatSessionTargetEntityType,
  DOCTYPE,
  DocumentStatus,
  TemplateDocument,
} from '@prisma/client';
import { Flex, Form, message, Skeleton, Splitter, Tag } from 'antd';
import { debounce } from 'lodash';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import HtmlEditor from '../../../common/components/HtmlEditor';
import HtmlPreview from '../../../common/components/HtmlPreview';
import TiptapEditor from '../../../common/components/TiptapEditor';
import {
  PRODUCT_TYPE_FULLSTACK,
  PROTOTYPE_TYPE_FRONTEND,
  translateStatusMessage,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import {
  useProjectAccessQuery,
  useProjectQuery,
} from '../../../common/hooks/useProjectsQuery';
import {
  StreamingFile,
  useStreamingStore,
} from '../../../common/store/streamingStore';
import { getHeaders } from '../../../common/util/apiHeaders';
import { checkIsGenerationLocked } from '../../../common/util/app';
import { GlobalStoreInst } from '../../../common/util/globalStore';
import {
  api_url,
  GenerateDocTypeToEventNameMap,
  UpdateDocTypeToEventNameMap,
} from '../../../lib/constants';
import { convertHTMLToParagraph } from '../../../lib/convert';
import trackEvent from '../../../trackingClient';
import { DatabaseModal } from '../../project/components/prototype/DatabaseModal';
import {
  handleViewDatabase,
  TableInfo,
} from '../../project/components/prototype/PrototypeDataBaseHandler';
import { handleDeploy } from '../../project/components/prototype/PrototypeDeployHandler';
import {
  FileComparisonResult,
  ProjectFile,
} from '../../project/components/prototype/PrototypeEditor';
import PrototypeEditorShow from '../../project/components/prototype/PrototypeEditorShow';
import StreamingEditor from '../../project/components/prototype/StreamingEditor';
import { TemplateCenterModal } from '../../templateDocument/components/TemplateCenterModal';
import { getDocumentApi } from '../api/getDocumentApi';
import { useDocument } from '../hooks/useDocument';
import { useUpdateDocumentMutation } from '../hooks/useDocumentMutation';
import {
  DocumentTypeNameMapping,
  TemplateDocumentOutput,
} from '../types/documentTypes';
import {
  ChatBox,
  ChatInputBoxCommand,
  ChatInputBoxPayload,
  IHandleCommand,
} from './ChatBox';
import { ChatRecord, UserType } from './ChatRecords';
import CodeDiffModal from './CodeDiffModal';
import DocumentHistory from './DocumentHistory';
import DocumentToolbar from './DocumentToolbar';
import EditorSidebar from './EditorSidebar';
import GeneratingDocLoader from './GeneratingDocLoader';
import { RequestDocumentAccess } from './requestDocumentAccess';

import './DocumentEditor.scss';

export type DocHistoryItem = {
  id?: string;
  versionNumber?: number;
  content?: string; // PRD
  fileUrl?: string; // PROTOTYPE
  description: string;
  date?: string; // Legacy field for backward compatibility
  createdAt?: string; // New field from DocumentHistory table
  email?: string;
  userId?: string;
  creatorEmail?: string;
  creatorUserId?: string;
  currentVersionUrl: string; // PROTOTYPE
  rating?: Array<{ userId: string; value: number }> | any;
  chosenDocumentIds?: string;
};

function useDocumentIdParam(): string {
  const { docId } = useParams();
  if (!docId) {
    throw new Error('You must specify a document ID parameter');
  }
  return docId;
}

export interface FileItem {
  fileName: string;
  fileUrl: string;
  id: number;
  documentId: string;
  fileBlob: File | null;
}

export interface FileContent {
  fileContent: string;
  fileType: string;
  fileId: string;
}

export function DocumentEditor() {
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [prototypeFiles, setPrototypeFiles] = useState<ProjectFile[]>([]);
  const [prototypeSourceUrl, setPrototypeSourceUrl] = useState<string>('');
  const [openSettingsModalFn, setOpenSettingsModalFn] = useState<
    ((initialTab?: string) => void) | null
  >(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChatBoxCollapsed, setIsChatBoxCollapsed] = useState(false);
  const [visualEditEnabled, setVisualEditEnabled] = useState(false);
  const [visualEditReady, setVisualEditReady] = useState(false);
  const prototypeDeployFnRef = useRef<(() => Promise<void>) | null>(null);
  const visualEditToggleRef = useRef<((enabled: boolean) => void) | null>(null);
  const { updateDocumentMutation } = useUpdateDocumentMutation({
    onSuccess: (doc) => {
      console.log('updateDocumentMutation.success');
      if (
        localDoc?.status !== DocumentStatus.PUBLISHED &&
        doc.status === DocumentStatus.PUBLISHED
      ) {
        let msg = t('document.publishedSuccessfully').replace(
          '{name}',
          doc.name
        );
        message.info(msg);
      }
      // Refresh the document data to update client-side state
      refetchDocument();
      setIsFetching(false);
      isFetchingContent.current = false;
    },
    onError: () => {
      console.error('error');
      setIsFetching(false);
      isFetchingContent.current = false;
    },
  });
  const splitterRef = useRef<HTMLDivElement>(null);

  // Ensure default width is between 300px and 50% of Splitter container width
  // This prevents the sidebar from being too wide on initial load
  const getConstrainedDefaultWidth = () => {
    let constrainedWidth = parseInt(
      localStorage.getItem('sideEditorWidth') || '300'
    );
    const minWidth = 300;

    // Get actual Splitter container width (not the whole window)
    const containerWidth =
      splitterRef.current?.offsetWidth || window.innerWidth;
    const maxWidth = Math.floor(containerWidth * 0.5); // 50% of Splitter container width

    // Constrain to minimum width
    if (constrainedWidth < minWidth) {
      constrainedWidth = minWidth;
    }

    // Constrain to maximum width (50% of container)
    if (constrainedWidth > maxWidth) {
      constrainedWidth = maxWidth;
    }

    // Update localStorage with the constrained value
    localStorage.setItem('sideEditorWidth', String(constrainedWidth));

    return constrainedWidth;
  };
  const documentId = useDocumentIdParam();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoCollapsedRef = useRef<Set<string>>(new Set());
  const {
    data: doc,
    isLoading,
    isError,
    refetch: refetchDocument,
  } = useDocument(documentId);

  const { data: project } = useProjectQuery(doc?.projectId);
  const { data: access } = useProjectAccessQuery(doc?.projectId);

  // Check document permission first (for shared documents), then fall back to project permission
  const documentPermission = doc?.documentPermission;
  const projectPermission = access?.projectPermission;
  const isReadOnly =
    documentPermission === 'VIEW' ||
    (!documentPermission && projectPermission === 'VIEW');
  const hasShownSuccessRef = useRef(false);
  /**
   * Streaming state is stored in Zustand when navigating between pages and cleared when streaming completes.
   * No entry in Zustand store means no active streaming for this document.
   */
  const isStreaming = useStreamingStore(
    (state: any) => state.isStreamingMap[documentId] || false
  );
  const statusMessage = useStreamingStore(
    (state: any) => state.statusMessageMap[documentId] || t('document.thinking')
  );
  const streamingFilesArray = useStreamingStore(
    (state: any) => state.streamingFilesMap[documentId]
  );

  // Get Zustand actions
  const setIsStreamingInStore = useStreamingStore(
    (state: any) => state.setIsStreaming
  );
  const setStatusMessageInStore = useStreamingStore(
    (state: any) => state.setStatusMessage
  );
  const setStreamingFilesInStore = useStreamingStore(
    (state: any) => state.setStreamingFiles
  );
  const clearStreamingInStore = useStreamingStore(
    (state: any) => state.clearStreaming
  );

  const formRef = useRef(null);
  const { showAppModal } = useAppModal();
  const { user, organization } = useCurrentUser();
  const [form] = Form.useForm();
  const isFetchingContent = useRef(false);
  const isGenerationLocked = checkIsGenerationLocked(organization);
  const triggerGenerateDocumentFromErrorRef =
    useRef<(chatContent: string) => void>();
  const chatBoxRef = useRef<(record: ChatRecord) => void>();
  const mountPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isDocFullScreen, setIsDocFullScreen] = useState(false);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>('');
  const [templateCenterOpen, setTemplateCenterOpen] = useState(false);
  const [selectTemplate, setSelectTemplate] =
    useState<TemplateDocumentOutput | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [localDoc, setLocalDoc] = useState(doc);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const getCurrentFilesRef = useRef<(() => ProjectFile[]) | null>(null);
  const [fileComparison, setFileComparison] =
    useState<FileComparisonResult | null>(null);
  const [prototypeToolbar, setPrototypeToolbar] =
    useState<React.ReactNode | null>(null);
  const [saveButtonState, setSaveButtonState] = useState<{
    onSave: () => void;
    hasUnsavedChanges: boolean;
    isEditing: boolean;
    hasFiles: boolean;
    isReadOnly: boolean;
  } | null>(null);

  // Reset prototype toolbar when document changes
  useEffect(() => {
    if (
      localDoc?.type !== DOCTYPE.PROTOTYPE &&
      localDoc?.type !== DOCTYPE.PRODUCT
    ) {
      setPrototypeToolbar(null);
      setSaveButtonState(null);
    }
  }, [localDoc?.type, documentId]);

  // Auto-collapse main sidepanel (AppLayout sidebar) when navigating from home or project home page
  useEffect(() => {
    if (!documentId) return;

    // Check if we've already auto-collapsed for this document
    if (hasAutoCollapsedRef.current.has(documentId)) return;

    // Check location state for auto-collapse flag
    const shouldAutoCollapse =
      (location.state as any)?.autoCollapseSidepanel === true;

    // Also check if we're coming from home or project home based on referrer
    const referrer = document.referrer;
    const isFromHome =
      referrer.includes('/index') ||
      referrer.endsWith(window.location.origin + '/') ||
      referrer.endsWith(window.location.origin + '/index');
    const isFromProjectHome =
      referrer.includes('/planning/builder') ||
      referrer.match(/\/projects\/[^/]+\/?$/);

    if (shouldAutoCollapse || isFromHome || isFromProjectHome) {
      // Auto-collapse the main AppLayout sidepanel (not the EditorSidebar which contains ChatBox)
      localStorage.setItem('sidebarCollapsed', 'true');
      // Dispatch a custom event to notify SidePanel to update its state
      window.dispatchEvent(
        new CustomEvent('sidebarCollapseChange', {
          detail: { collapsed: true },
        })
      );
      hasAutoCollapsedRef.current.add(documentId);
    }
  }, [location.pathname, location.state, documentId]);

  // Use useCallback to stabilize setPrototypeToolbar reference
  const handleToolbarRender = useCallback((toolbar: React.ReactNode | null) => {
    setPrototypeToolbar(toolbar);
  }, []);

  // Handle save button state change
  const handleSaveStateChange = useCallback(
    (state: {
      onSave: () => void;
      hasUnsavedChanges: boolean;
      isEditing: boolean;
      hasFiles: boolean;
      isReadOnly: boolean;
    }) => {
      setSaveButtonState(state);
    },
    []
  );

  const handleVisualEditStateChange = useCallback(
    (state: {
      enabled: boolean;
      ready: boolean;
      onToggle: (enabled: boolean) => void;
    }) => {
      setVisualEditEnabled(state.enabled);
      setVisualEditReady(state.ready);
      visualEditToggleRef.current = state.onToggle;
    },
    []
  );

  const handleVisualEditToggle = useCallback((enabled: boolean) => {
    if (visualEditToggleRef.current) {
      visualEditToggleRef.current(enabled);
    }
  }, []);

  // Handle clicking outside the editor to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const editorContainer = document.querySelector('.editor-content');
      const placeholder = document.querySelector('.editor-placeholder');

      if (isInEditMode && !localDoc?.contents) {
        if (
          editorContainer &&
          !editorContainer.contains(event.target as Node) &&
          placeholder &&
          !placeholder.contains(event.target as Node)
        ) {
          setIsInEditMode(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInEditMode, localDoc?.contents]);
  const [isDatabaseModalVisible, setIsDatabaseModalVisible] = useState(false);
  const [databaseData, setDatabaseData] = useState<TableInfo[]>([]);
  const [databaseSettings, setDatabaseSettings] = useState<{
    DATABASE_URL?: string;
    JWT_SECRET?: string;
  } | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  // Create a Map from the Zustand array for compatibility with existing code
  const [streamingFiles, setStreamingFiles] = useState<
    Map<string, ProjectFile>
  >(new Map());

  // Convert Zustand array to Map whenever it changes
  useEffect(() => {
    if (streamingFilesArray && streamingFilesArray.length > 0) {
      const newMap = new Map();
      streamingFilesArray.forEach((file: any) => {
        newMap.set(file.path, file as ProjectFile);
      });
      setStreamingFiles(newMap);
    } else if (isStreaming) {
      // Just set an empty map if streaming is active but no files yet
      setStreamingFiles(new Map());
    }
  }, [streamingFilesArray, isStreaming]);

  // Listen for global cancel from ChatBox stop button and force clear streaming UI
  useEffect(() => {
    const onGlobalCancel = (e: Event) => {
      const detail = (e as CustomEvent).detail as { documentId?: string };
      if (!detail || !detail.documentId || detail.documentId === documentId) {
        clearStreamingInStore(documentId);
        setIsFetching(false);
        isFetchingContent.current = false;
        setLoadingPercent(0);
        setStatusMessageInStore(documentId, '');
      }
    };
    window.addEventListener(
      'cancel-document-generation',
      onGlobalCancel as EventListener
    );
    return () => {
      window.removeEventListener(
        'cancel-document-generation',
        onGlobalCancel as EventListener
      );
    };
  }, [documentId, clearStreamingInStore, setStatusMessageInStore]);

  useEffect(() => {
    setLocalDoc(doc);
  }, [doc, documentId]);

  // Reset prototype files and source URL when document changes
  useEffect(() => {
    setPrototypeFiles([]);
    setPrototypeSourceUrl('');
  }, [documentId]);

  // Shared function to check generation status
  const createCheckGenerationStatus = useCallback(
    (
      clearIntervalFn: () => void,
      logMessage: string = 'Generation completed, refetching document',
      errorMessage: string = 'Error checking generation status:'
    ) => {
      return async () => {
        try {
          const headers = await getHeaders();
          const response = await fetch(
            `${api_url}/api/documents/${documentId}/status`,
            { headers }
          );
          if (response.ok) {
            const result = await response.json();
            if (result.success && !result.isGenerating) {
              clearIntervalFn();
              console.log(logMessage);
              clearStreamingInStore(documentId);
              setIsFetching(false);
              isFetchingContent.current = false;
              setLoadingPercent(100);
              await refetchDocument();
            }
          }
        } catch (error) {
          console.error(errorMessage, error);
        }
      };
    },
    [documentId, clearStreamingInStore, refetchDocument]
  );

  // Check generation status on mount if isStreaming is true (e.g., after page reload)
  // This handles the case where the page was reloaded while generation was in progress
  // or where localStorage has stale isStreaming=true state
  useEffect(() => {
    if (!documentId) return;

    // Only start polling if isStreaming is true (stale state from localStorage)
    if (!isStreaming) {
      // Clear any existing polling interval if isStreaming becomes false
      if (mountPollingIntervalRef.current) {
        clearInterval(mountPollingIntervalRef.current);
        mountPollingIntervalRef.current = null;
      }
      return;
    }

    const checkGenerationStatus = createCheckGenerationStatus(
      () => {
        if (mountPollingIntervalRef.current) {
          clearInterval(mountPollingIntervalRef.current);
          mountPollingIntervalRef.current = null;
        }
      },
      'Generation completed on page reload, clearing stale state',
      'Error checking generation status on mount:'
    );

    // Check immediately
    checkGenerationStatus();

    // Start polling every 3 seconds
    mountPollingIntervalRef.current = setInterval(checkGenerationStatus, 5000);

    // Cleanup on unmount or when isStreaming becomes false
    return () => {
      if (mountPollingIntervalRef.current) {
        clearInterval(mountPollingIntervalRef.current);
        mountPollingIntervalRef.current = null;
      }
    };
  }, [isStreaming, documentId, createCheckGenerationStatus]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 575);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    if (!form || !formRef?.current) {
      return;
    }

    form.setFieldsValue({
      name: localDoc?.name || '',
      description:
        localDoc?.description || localDoc?.project?.description || '',
      contents: localDoc?.contents,
      url: localDoc?.url || '',
    });

    if (localDoc?.templateDocument) {
      setSelectTemplate(localDoc?.templateDocument);
    }
  }, [localDoc, form, formRef]);

  // Memoize paragraphs to avoid re-parsing HTML on every render
  const paragraphs = useMemo(() => {
    if (localDoc?.type === DOCTYPE.PRD) {
      return convertHTMLToParagraph({ doc: localDoc as any });
    }
    return [];
  }, [localDoc?.contents, localDoc?.type]);

  const onUpdateHTML = debounce(
    useCallback(
      (e: string, timestamp: number) => {
        form.setFieldValue('contents', e);
      },
      [form]
    ),
    1000
  );

  const updateDoc = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      refreshPage: boolean = true,
      isPublish: boolean = false
    ) => {
      let action: string;
      if (isPublish) {
        action = 'publish';
      } else {
        action = e?.currentTarget?.dataset?.action || '';
      }
      let { name, description, contents, url } = form.getFieldsValue();
      let payload = {
        id: documentId,
        name,
        projectId: localDoc?.projectId,
        type: localDoc?.type,
        description: description,
        contentStr: contents || '',
        url,
        status:
          action === 'publish' ? DocumentStatus.PUBLISHED : localDoc?.status,
      };
      updateDocumentMutation.mutate(payload);
      // track event
      trackEvent(action === 'publish' ? 'publishDocument' : 'updateDocument', {
        distinct_id: user.email,
        payload: JSON.stringify({
          documentId: documentId,
          documentType: localDoc?.type,
          description,
          action,
        }),
      });
      if (refreshPage) {
        setIsFetching(true);
      }
    },
    [
      documentId,
      localDoc,
      form,
      updateDocumentMutation,
      user.email,
      setIsFetching,
    ]
  );

  // Memoize the debounced updateDoc function to prevent recreation on every render
  const debouncedUpdateDoc = useMemo(
    () =>
      debounce((e: React.MouseEvent<HTMLButtonElement>, contents: string) => {
        updateDoc(e, false);
      }, 2000),
    [updateDoc]
  );

  const triggerDocumentRefetch = useCallback(
    (interval = 1000) => {
      setTimeout(async () => {
        if (isFetchingContent.current) {
          let updatedDoc = await getDocumentApi(documentId);
          if (updatedDoc?.contents) {
            console.log('triggerDocumentRefetch:', Date.now());
            form.setFieldValue('contents', updatedDoc.contents);
            setLocalDoc(updatedDoc);
            setIsFetching(false);
            isFetchingContent.current = false;
            if (
              updatedDoc.type === DOCTYPE.PROTOTYPE ||
              updatedDoc.type === DOCTYPE.PRODUCT
            ) {
              setSourceUrl(updatedDoc.meta?.sourceUrl as string);
            }
          } else {
            triggerDocumentRefetch(5000);
          }
        }
      }, interval);
    },
    [documentId, form]
  );

  const updateLoadingPercent = useCallback(() => {
    if (!isFetchingContent.current) {
      return;
    }
    setTimeout(() => {
      setLoadingPercent((currentPercent) => {
        if (currentPercent < 100) {
          // distribute increase to 1min (60s) to get to 100%
          return Math.min(99, Math.floor(currentPercent + Math.random() * 5));
        }
        return currentPercent;
      });
      updateLoadingPercent();
    }, 1500);
  }, []);

  const handleDeployClick = useCallback(async () => {
    // For PROTOTYPE and PRODUCT, use the PrototypeEditor's handleSave function
    if (
      (localDoc?.type === DOCTYPE.PROTOTYPE ||
        localDoc?.type === DOCTYPE.PRODUCT) &&
      prototypeDeployFnRef.current
    ) {
      await prototypeDeployFnRef.current();
      return;
    }

    // For other document types, use the old deploy logic
    if (!localDoc?.id) {
      message.error(t('document.saveFirst'));
      return;
    }
    const success = await handleDeploy(
      localDoc.id,
      localDoc.issueId as string,
      sourceUrl || localDoc?.meta?.sourceUrl || '',
      t
    );

    if (success) {
      // Refresh the document to get the updated deployment status
      refetchDocument();
    }
  }, [
    localDoc?.id,
    localDoc?.type,
    localDoc?.meta?.sourceUrl,
    sourceUrl,
    refetchDocument,
    localDoc?.issueId,
    t,
  ]);

  const handleSaveDatabaseSettings = async (settings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  }) => {
    if (!localDoc?.id) return;

    try {
      // Update document metadata with new settings
      const updatedMeta = {
        ...((localDoc.meta as Record<string, any>) || {}),
        envSettings: settings,
      };

      await updateDocumentMutation.mutateAsync({
        id: localDoc.id,
        meta: updatedMeta,
      });

      // Update local state
      setLocalDoc((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          meta: updatedMeta,
        };
      });

      // Refresh database tables
      const result = await handleViewDatabase(localDoc.id);
      setDatabaseData(result.tables);
    } catch (error) {
      console.error('Error saving database settings:', error);
      throw error;
    }
  };

  const handlePublish = useCallback(async () => {
    // Call the updateDoc function with isPublish: true
    if (updateDoc) {
      updateDoc({} as React.MouseEvent<HTMLButtonElement>, false, true);
    }
  }, [updateDoc]);

  const handleViewDiff = useCallback(() => {
    setDiffModalOpen(true);
  }, []);

  const handleShareDoc = useCallback(() => {
    if (!localDoc) return;
    trackEvent('shareDocument', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: localDoc.id,
        documentType: localDoc.type,
        source: 'prototypeEditorToolbar',
      }),
    });
    showAppModal({
      type: 'docSharing',
      docId: localDoc.id,
      title: `Share "${localDoc.name}"`,
      documentAccess: localDoc.access || 'ORGANIZATION',
    });
  }, [localDoc, user.email, showAppModal]);

  if (!localDoc) {
    return (
      <>
        <Skeleton active />
      </>
    );
  }
  if (isError) {
    return (
      <RequestDocumentAccess
        documentId={documentId}
        onSuccess={() => {
          message.success(t('document.requestSentSuccessfully'));
          setTimeout(() => {
            navigate(`/index`);
          }, 1000);
        }}
      />
    );
  }

  async function generateContent(payload: ChatInputBoxPayload) {
    // Guard: Prevent concurrent generation
    if (isFetchingContent.current || isFetching) {
      console.warn(
        'Generation already in progress, ignoring duplicate request'
      );
      return;
    }

    if (isGenerationLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'documentEditor',
          destination: `generate:${localDoc?.type}`,
        },
      });
      return;
    }

    try {
      if (
        localDoc?.type === DOCTYPE.PRD ||
        localDoc?.type === DOCTYPE.PROPOSAL
      ) {
        const values = await form.validateFields();
        console.log('Success:', values);
      }
    } catch (error) {
      console.log('Failed:', error);
      return;
    }
    const { chatContent } = payload;
    console.log('selectTemplate=', selectTemplate);

    if (
      localDoc?.type === DOCTYPE.PRD ||
      localDoc?.type === DOCTYPE.UI_DESIGN ||
      localDoc?.type === DOCTYPE.TECH_DESIGN ||
      localDoc?.type === DOCTYPE.QA_PLAN ||
      localDoc?.type === DOCTYPE.RELEASE_PLAN ||
      localDoc?.type === DOCTYPE.PROTOTYPE ||
      localDoc?.type === DOCTYPE.PRODUCT
    ) {
      // track event
      const eventName = localDoc?.contents
        ? UpdateDocTypeToEventNameMap[localDoc?.type]
        : GenerateDocTypeToEventNameMap[localDoc?.type];

      trackEvent(eventName, {
        distinct_id: user.email,
        payload: JSON.stringify({
          documentId: documentId,
          documentType: localDoc?.type,
          description:
            chatContent ||
            localDoc?.description ||
            localDoc?.project?.description ||
            '',
        }),
      });
      // Set fetching state immediately so loader shows before server response
      setIsFetching(true);
      isFetchingContent.current = true;
      setLoadingPercent(0);
      handleGenerateDocumentStreaming(payload);
    } else {
      setIsFetching(true);
      isFetchingContent.current = true;
      // in case Heroku kills HTTP request 30s after the first one, we need to trigger a refetch
      // TODO - Try out streaming API to avoid this
      setLoadingPercent(0);
      updateLoadingPercent();
      triggerDocumentRefetch();
    }
  }

  async function handleGenerateDocumentStreaming(payload: ChatInputBoxPayload) {
    setIsFetching(true);
    setLoadingPercent(0);
    updateLoadingPercent();

    try {
      // Make the streaming request
      const { chatContent, fileContentList, chosenDocumentIds, chatSessionId } =
        payload;
      const headers = await getHeaders();
      // Get current form values to include any manual edits
      const currentFormValues = form.getFieldsValue();
      const response = await fetch(
        `${api_url}/api/documents/generate-document-streaming`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entityId: documentId,
            entityType: ChatSessionTargetEntityType.DOCUMENT,
            entitySubType: doc?.type || '',
            name: currentFormValues.name || doc?.name || '',
            description:
              chatContent ||
              currentFormValues.description ||
              doc?.description ||
              '',
            projectId: doc?.projectId,
            contents: currentFormValues.contents || doc?.contents,
            imageBase64: currentImage,
            templateId:
              doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT
                ? ''
                : selectTemplate?.id || '',
            uploadedFileContent: fileContentList, //add uploaded file content
            chosenDocumentIds: chosenDocumentIds?.length
              ? chosenDocumentIds.join(',')
              : '', // add chosen document ids
            chatSessionId: chatSessionId,
            meta: doc?.meta,
            // add isFixingDeploymentError to the payload to indicate if the user is fixing a deployment error
            isFixingDeploymentError: GlobalStoreInst.get(
              'isFixingDeploymentError'
            ),
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await response.text(); // Get error details from backend
        throw new Error(
          `Request failed with status ${response.status}: ${errorMessage}`
        );
      }
      // reset isFixingDeploymentError in GlobalStoreInst
      GlobalStoreInst.set('isFixingDeploymentError', false);

      // For PROTOTYPE/PRODUCT, set isStreaming early (they use StreamingEditor which needs it)
      // For PRD and other regular documents, wait until content arrives to hide the loader
      if (
        localDoc?.type === DOCTYPE.PROTOTYPE ||
        localDoc?.type === DOCTYPE.PRODUCT
      ) {
        setIsStreamingInStore(documentId, true);
      }
      // Determine if this is an update or creation
      const isUpdate =
        doc?.contents ||
        (doc?.type === 'PRODUCT' &&
          (prototypeFiles.length > 0 ||
            doc?.meta?.sourceUrl ||
            doc?.meta?.builtFileUrl)) ||
        (doc?.type === 'PROTOTYPE' &&
          (prototypeFiles.length > 0 ||
            doc?.meta?.sourceUrl ||
            doc?.meta?.builtFileUrl));

      setStatusMessageInStore(
        documentId,
        isUpdate
          ? t('generation.updatingDocument').replace(
              '{docType}',
              doc?.type
                ? DocumentTypeNameMapping(t)[doc.type]?.name.toLowerCase()
                : ''
            )
          : t('generation.creatingDocument').replace(
              '{docType}',
              doc?.type
                ? DocumentTypeNameMapping(t)[doc.type]?.name.toLowerCase()
                : ''
            )
      );
      setStreamingFilesInStore(documentId, []);

      await handleStreamingContent(response);
      setPrototypeFiles([]);
      setPrototypeSourceUrl('');
    } catch (error: any) {
      console.error(
        'Error in DocumentEditor.handleGenerateDocumentStreaming:',
        error
      );

      message.error(t('document.failedToCompleteAI'));

      setIsFetching(false);
      isFetchingContent.current = false;
      setLoadingPercent(0);

      // Clear streaming state in Zustand
      clearStreamingInStore(documentId);
    }
  }

  async function handleStreamingContent(response: Response) {
    const reader = response.body!!.getReader();
    const decoder = new TextDecoder();

    if (
      localDoc?.type === DOCTYPE.PROTOTYPE ||
      localDoc?.type === DOCTYPE.PRODUCT
    ) {
      await handlePrototypeStreaming(reader, decoder);
    } else {
      await handleRegularDocumentStreaming(reader, decoder);
    }
  }

  async function handlePrototypeStreaming(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ) {
    // Start with an empty array for streaming files
    let currentFiles: StreamingFile[] = [];
    let firstContentReceived = false;
    let connectionLost = false;
    let pollingInterval: NodeJS.Timeout | null = null;

    // Function to check document generation status
    const checkGenerationStatus = createCheckGenerationStatus(() => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    });

    // Start polling if connection is lost
    const startPolling = () => {
      if (pollingInterval) return; // Already polling
      console.log('Connection lost, starting polling for generation status');
      connectionLost = true;
      // Poll every 3 seconds (transparent to user)
      pollingInterval = setInterval(checkGenerationStatus, 3000);
      // Also check immediately
      checkGenerationStatus();
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Streaming completed - clearing states');
          // Clear streaming state in Zustand when streaming is complete
          clearStreamingInStore(documentId);

          // Reset fetching state when streaming completes
          setIsFetching(false);
          isFetchingContent.current = false;
          setLoadingPercent(100);

          console.log('States cleared - isStreaming should be false now');

          // Stop polling if it was running
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }

          // refetch document with files updated
          await refetchDocument();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          let lineTrim = line.trim();
          if (!lineTrim) continue;

          try {
            const parsed = JSON.parse(lineTrim);
            if (parsed.keepalive) {
              console.log('skip keepalive message:', parsed.keepalive);
              continue;
            }

            // Handle status messages
            if (parsed.status?.message) {
              console.log('Received status:', parsed.status.message);

              // Update status message in Zustand
              setStatusMessageInStore(
                documentId,
                translateStatusMessage(parsed.status.message, t)
              );
              continue;
            }

            // Handle chat messages
            if (parsed?.chats?.path && parsed?.chats?.content) {
              if (!firstContentReceived) {
                setIsFetching(false);
                firstContentReceived = true;
              }

              const { path, content } = parsed.chats;

              chatBoxRef.current?.({
                type: UserType.AI,
                message: content,
              });

              continue;
            }

            // Handle file content
            if (parsed?.text?.path && parsed?.text?.content) {
              if (!firstContentReceived) {
                setIsFetching(false);
                firstContentReceived = true;
              }

              console.log('Received file:', parsed.text.path);
              const { path, content } = parsed.text;
              const formattedContent =
                typeof content === 'object'
                  ? JSON.stringify(content, null, 2)
                  : String(content);

              // Create the new file
              const newFile = {
                type: 'file',
                path,
                content: formattedContent,
              };

              // Update our local array with the new file
              currentFiles = [
                ...currentFiles.filter((f) => f.path !== path),
                newFile,
              ];

              // Update streaming files in Zustand
              setStreamingFilesInStore(documentId, currentFiles);

              // We still need to update the document content for persistence
              const fileContent = JSON.stringify({
                files: currentFiles,
              });

              setLocalDoc((prev) => ({
                ...prev!,
                contents: fileContent,
              }));
            }
          } catch (error) {
            console.error('Error processing streaming data:', error, lineTrim);
          }
        }
      }
    } catch (error: any) {
      // Connection error - start polling
      console.error('Streaming connection error:', error);
      if (!connectionLost) {
        startPolling();
      }
    } finally {
      // Clean up polling interval on component unmount or completion
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }
  }

  async function handleRegularDocumentStreaming(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ) {
    let accumulatedContent = '';
    let firstTextReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Clear streaming state in Zustand when streaming is complete
        clearStreamingInStore(documentId);

        // Reset fetching state when streaming completes
        setIsFetching(false);
        isFetchingContent.current = false;
        setLoadingPercent(100);

        // Refetch document to get the latest content from server
        // This is crucial for documents that were stopped - shows preserved content
        await refetchDocument();

        // show success message
        message.success(t('common.docGenerated'), 2);
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        let lineTrim = line.trim();
        if (!lineTrim) continue;

        try {
          const parsed = JSON.parse(lineTrim);
          // skip keepalive messages
          if (parsed.keepalive) {
            console.log('skip keepalive message:', parsed.keepalive);
            continue;
          }
          if (parsed.text?.content) {
            if (!firstTextReceived) {
              // First content received - now set isStreaming to true to hide loader
              setIsStreamingInStore(documentId, true);
              setIsFetching(false);
              firstTextReceived = true;
            }
            accumulatedContent += parsed.text.content;
            form.setFieldValue('contents', accumulatedContent);
          }
        } catch (error) {
          console.error('Error processing streaming data:', error, lineTrim);
        }
      }
    }

    // Final update after streaming is complete
    if (localDoc) {
      console.log('localDoc:', localDoc);
      setLocalDoc({
        ...localDoc,
        contents: accumulatedContent,
      });
    }
    setEditorKey((prev) => prev + 1);
  }

  function handleOnInputBoxCommand(
    command: IHandleCommand['command'],
    payload: ChatInputBoxPayload
  ) {
    switch (command) {
      case ChatInputBoxCommand.GENERATE:
        generateContent(payload);
        break;
    }
  }

  const breadcrumbItems = localDoc?.projectId
    ? [
        {
          key: localDoc?.projectId,
          link: isReadOnly ? '' : `/projects/${localDoc?.projectId}`,
          label: isReadOnly ? (
            <>
              {project?.name} <Tag>{t('project.view')}</Tag>
            </>
          ) : (
            project?.name
          ),
        },
      ]
    : [
        {
          key: 'documents',
          label: 'Documents',
          link: `/docs`,
        },
        {
          key: localDoc?.type as string,
          label: localDoc?.name as string,
        },
      ];

  const fullScreenIconStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    fontSize: '24px',
    bottom: '6px',
    right: '10px',
    display: 'none',
  };

  const isGeneratingDoc =
    (isLoading && !isRefetching) || isFetching || isFetchingContent.current;

  const updateDocFullScreen = () => {
    console.log('updateDocFullScreen');
    setIsDocFullScreen(!isDocFullScreen);
  };

  const handleConvertToApp = async (
    conversionType?:
      | typeof PROTOTYPE_TYPE_FRONTEND
      | typeof PRODUCT_TYPE_FULLSTACK
  ) => {
    const prototypeDoc = project?.documents.find(
      (d) => d.type === DOCTYPE.PROTOTYPE
    );
    const productDoc = project?.documents.find(
      (d) => d.type === DOCTYPE.PRODUCT
    );
    const targetDoc =
      conversionType === PROTOTYPE_TYPE_FRONTEND ? prototypeDoc : productDoc;

    if (!targetDoc) {
      console.error('Target document not found');
      return;
    }

    // Set the auto-generate flag and navigate immediately
    // This ensures ChatBox on the prototype/product page will trigger generation
    // instead of ChatBox on PRD page triggering PRD regeneration
    GlobalStoreInst.set('autoGenerateDocForPRD', doc?.id);

    // Navigate to prototype/product page - ChatBox there will check the flag
    navigate(`/docs/${targetDoc?.id}`);

    // Publish the PRD asynchronously after navigation (non-blocking)
    // This avoids triggering ChatBox useEffect on the PRD page
    if (localDoc?.status !== DocumentStatus.PUBLISHED) {
      // Publish PRD in background without triggering regeneration
      updateDocumentMutation.mutate({
        id: documentId,
        name: localDoc?.name,
        projectId: localDoc?.projectId,
        type: localDoc?.type,
        description: localDoc?.description,
        contentStr: localDoc?.contents || '',
        url: localDoc?.url,
        status: DocumentStatus.PUBLISHED,
      });
    }

    // track event
    const eventName =
      conversionType === PROTOTYPE_TYPE_FRONTEND
        ? 'generatePrototype'
        : 'generateProduct';
    trackEvent(eventName, {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: documentId,
        documentType: localDoc?.type,
        action: 'handleConvertToApp',
      }),
    });
  };

  return (
    <Form ref={formRef} form={form} className="document-form">
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0px 8px',
          minHeight: 56,
          borderBottom: '1px solid #eee',
          backgroundColor: '#fff',
        }}
      >
        <DocumentToolbar
          breadcrumbItems={breadcrumbItems}
          doc={localDoc}
          updateDoc={updateDoc}
          paragraphs={paragraphs}
          pdfLineHeight={1.3}
          onDeploy={handleDeployClick}
          handleConvertToApp={handleConvertToApp}
          isReadOnly={isReadOnly}
          toolbarDisabled={
            !localDoc?.contents &&
            localDoc.type !== DOCTYPE.PROTOTYPE &&
            localDoc.type !== DOCTYPE.PRODUCT
          }
          isStreaming={isStreaming}
          isGeneratingDoc={isGeneratingDoc}
          onOpenSettingsModal={(fn) => setOpenSettingsModalFn(() => fn)}
          onToggleChatCollapse={() =>
            setIsChatBoxCollapsed(!isChatBoxCollapsed)
          }
          onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
          onToggleSidepanel={() => setIsDocFullScreen(!isDocFullScreen)}
          isSidepanelVisible={!isDocFullScreen}
          centerActions={
            localDoc?.type === DOCTYPE.PROTOTYPE ||
            localDoc?.type === DOCTYPE.PRODUCT
              ? prototypeToolbar
              : undefined
          }
          saveButtonState={
            localDoc?.type === DOCTYPE.PROTOTYPE ||
            localDoc?.type === DOCTYPE.PRODUCT
              ? saveButtonState || undefined
              : undefined
          }
        />
      </div>

      <div ref={splitterRef} style={{ height: 'calc(100% - 56px)' }}>
        <Splitter
          layout="horizontal"
          onResizeEnd={(sizes) => {
            localStorage.setItem('sideEditorWidth', String(sizes[0]));
          }}
          style={{ height: '100%' }}
        >
          {!isReadOnly && !isMobile && !isDocFullScreen && (
            <Splitter.Panel
              resizable
              min={300}
              max={'50%'}
              defaultSize={getConstrainedDefaultWidth()}
            >
              <EditorSidebar
                selectedTemplate={selectTemplate}
                setProjectFiles={setPrototypeFiles}
                setPrototypeSourceUrl={setPrototypeSourceUrl}
                onClickTemplateIcon={() =>
                  setTemplateCenterOpen(!templateCenterOpen)
                }
                setActiveHistory={(item) => setCurrentImage(null)}
                form={form}
                setSelectTemplate={setSelectTemplate}
                document={localDoc}
                isDocFullScreen={isDocFullScreen}
                setIsDocFullScreen={setIsDocFullScreen}
                refetchDocument={refetchDocument}
                setLocalDoc={setLocalDoc}
              >
                <ChatBox
                  style={{ height: '100%', backgroundColor: 'blue' }}
                  isGeneratingDoc={isGeneratingDoc}
                  isStreaming={isStreaming}
                  doc={localDoc}
                  currentImage={
                    (currentImage || localDoc?.imageBase64) as string
                  }
                  selectedTemplateId={selectTemplate?.id as string}
                  placeholder={
                    isMobile
                      ? t('document.sendMessage')
                      : localDoc?.contents
                        ? t('document.addFeedbackOrQuestion')
                        : t('document.enterInstructions')
                  }
                  onCommand={handleOnInputBoxCommand}
                  onSaveDatabaseSettings={handleSaveDatabaseSettings}
                  disableSend={isReadOnly}
                  setTriggerGenerateDocumentFromError={(fn) => {
                    triggerGenerateDocumentFromErrorRef.current = fn;
                  }}
                  setAppendToChatRecordsFn={(fn) => {
                    chatBoxRef.current = fn;
                  }}
                  setCurrentImage={setCurrentImage}
                  handleConvertToApp={handleConvertToApp}
                  onPublish={handlePublish}
                  onOpenSettingsModal={openSettingsModalFn || undefined}
                  isChatBoxCollapsed={isChatBoxCollapsed}
                  onChatBoxCollapseChange={setIsChatBoxCollapsed}
                  visualEditEnabled={visualEditEnabled}
                  visualEditReady={visualEditReady}
                  onVisualEditToggle={handleVisualEditToggle}
                />
              </EditorSidebar>
            </Splitter.Panel>
          )}
          <Splitter.Panel
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              flex: 1,
            }}
          >
            <div
              id="document-editor-container"
              style={{ height: '100%', overflow: 'auto', width: '100%' }}
            >
              {/* Show GeneratingDocLoader for all document types EXCEPT when StreamingEditor is active or when content is streaming */}
              {isGeneratingDoc && !isStreaming && (
                <GeneratingDocLoader
                  docType={localDoc.type as string}
                  isUpdatingDoc={
                    !!(
                      localDoc?.contents ||
                      doc?.contents ||
                      (localDoc?.id && localDoc.id !== 'new') ||
                      (doc?.id && doc.id !== 'new')
                    )
                  }
                  loadingPercent={isGeneratingDoc ? loadingPercent : undefined}
                  streamingFiles={Array.from(streamingFiles.values())}
                  statusMessage={statusMessage}
                />
              )}
              <div
                style={{ height: '100%', position: 'relative', width: '100%' }}
              >
                {isDocFullScreen ? (
                  <FullscreenExitOutlined
                    title="Exit full screen"
                    style={fullScreenIconStyle}
                    onClick={updateDocFullScreen}
                  />
                ) : (
                  <FullscreenOutlined
                    title={t('document.fullScreen')}
                    style={fullScreenIconStyle}
                    onClick={updateDocFullScreen}
                  />
                )}
                <Flex
                  vertical
                  style={{ height: '100%', padding: '0 16px 0' }}
                  className="document-editor-content"
                >
                  <Form.Item name="contents" rules={[{ required: false }]}>
                    {localDoc?.type === DOCTYPE.UI_DESIGN && (
                      <HtmlEditor
                        onUpdate={onUpdateHTML}
                        isStreaming={isStreaming}
                        readOnly={isReadOnly}
                      />
                    )}
                    {(localDoc?.type === DOCTYPE.PROTOTYPE ||
                      localDoc?.type === DOCTYPE.PRODUCT) &&
                      (isStreaming ? (
                        <StreamingEditor
                          files={Array.from(streamingFiles.values())}
                          statusMessage={statusMessage}
                          documentId={documentId}
                          documentType={localDoc?.type}
                          onToolbarRender={handleToolbarRender}
                          document={localDoc}
                          access={access}
                          onShare={handleShareDoc}
                        />
                      ) : (
                        <PrototypeEditorShow
                          document={localDoc}
                          setSourceUrl={setSourceUrl}
                          access={access}
                          projectFiles={prototypeFiles}
                          prototypeSourceUrl={prototypeSourceUrl}
                          onFixErrorsClick={(errorMsg) =>
                            triggerGenerateDocumentFromErrorRef.current?.(
                              errorMsg
                            )
                          }
                          onDeployRef={(deployFn) => {
                            prototypeDeployFnRef.current = deployFn;
                          }}
                          refetchDocument={refetchDocument}
                          onViewDiff={handleViewDiff}
                          onGetCurrentFiles={(getCurrentFilesFn) => {
                            getCurrentFilesRef.current = getCurrentFilesFn;
                          }}
                          onFileComparisonChange={setFileComparison}
                          onToolbarRender={handleToolbarRender}
                          onShare={handleShareDoc}
                          onSaveStateChange={handleSaveStateChange}
                          onVisualEditStateChange={handleVisualEditStateChange}
                        />
                      ))}
                    {localDoc?.type !== DOCTYPE.UI_DESIGN &&
                      localDoc?.type !== DOCTYPE.PROTOTYPE &&
                      localDoc?.type !== DOCTYPE.PRODUCT &&
                      (isReadOnly ? (
                        <div style={{ paddingTop: 16, height: '100%' }}>
                          {localDoc?.type === DOCTYPE.PRD ? (
                            <TiptapEditor
                              value={localDoc?.contents || ''}
                              editable={false}
                              showToolbar={false}
                            />
                          ) : (
                            <HtmlPreview content={localDoc?.contents || ''} />
                          )}
                        </div>
                      ) : (
                        <>
                          {!localDoc?.contents &&
                          !isStreaming &&
                          !isInEditMode ? (
                            <div
                              className="editor-placeholder"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                width: '100%',
                                padding: '40px 20px',
                                textAlign: 'center',
                                color: '#666',
                                backgroundColor: '#fafafa',
                                borderRadius: '8px',
                                border: '2px dashed #d9d9d9',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                margin: '20px 0',
                              }}
                              onClick={() => {
                                setIsInEditMode(true);
                                // Focus on the TiptapEditor when clicked
                                setTimeout(() => {
                                  const editorElement =
                                    document.querySelector('.ProseMirror');
                                  if (editorElement) {
                                    (editorElement as HTMLElement).focus();
                                  }
                                }, 100);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  '#f0f0f0';
                                e.currentTarget.style.borderColor = '#5345F3';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  '#fafafa';
                                e.currentTarget.style.borderColor = '#d9d9d9';
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '16px',
                                  marginBottom: '12px',
                                  color: '#333',
                                }}
                              >
                                {t('document.chatWithJoyToCreate')}{' '}
                                {localDoc?.type
                                  ? DocumentTypeNameMapping(t)[localDoc.type]
                                      ?.name
                                  : 'Document'}
                              </div>
                              <div
                                style={{
                                  fontSize: '14px',
                                  lineHeight: '1.5',
                                  maxWidth: '300px',
                                }}
                              >
                                {t('document.orClickToEdit')}
                              </div>
                            </div>
                          ) : (
                            <TiptapEditor
                              key={editorKey}
                              selectedTemplate={selectTemplate}
                              onClickTemplateIcon={() =>
                                setTemplateCenterOpen(!templateCenterOpen)
                              }
                              isStreaming={isStreaming}
                              docId={documentId}
                              onUpdate={debouncedUpdateDoc}
                              editable={!isReadOnly}
                              hasShownSuccessRef={hasShownSuccessRef}
                            />
                          )}
                        </>
                      ))}
                  </Form.Item>
                </Flex>
              </div>
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
      <TemplateCenterModal
        open={templateCenterOpen}
        onClose={() => setTemplateCenterOpen(false)}
        selectedTemplateId={selectTemplate?.id}
        onUseTemplate={(template: TemplateDocument) =>
          setSelectTemplate(template)
        }
      />

      {isDatabaseModalVisible && databaseData && (
        <DatabaseModal
          tables={databaseData}
          settings={databaseSettings}
          onClose={() => setIsDatabaseModalVisible(false)}
          onSaveSettings={handleSaveDatabaseSettings}
          documentId={localDoc?.id || ''}
        />
      )}

      {/* Code Diff Modal for PROTOTYPE/PRODUCT documents */}
      {(localDoc?.type === DOCTYPE.PROTOTYPE ||
        localDoc?.type === DOCTYPE.PRODUCT) && (
        <CodeDiffModal
          open={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          currentFiles={(() => {
            try {
              if (localDoc?.contents) {
                const parsed = JSON.parse(localDoc.contents);
                return parsed.files || [];
              }
              return [];
            } catch (error) {
              console.error(
                'Failed to parse document contents for diff:',
                error
              );
              return [];
            }
          })()}
          docId={documentId}
          projectFiles={
            getCurrentFilesRef.current
              ? getCurrentFilesRef.current()
              : undefined
          }
        />
      )}
      <DocumentHistory
        document={localDoc}
        onHandleHistoryChange={async (
          item: DocHistoryItem,
          versionNumber: number
        ) => {
          if (localDoc?.type === 'PRD') {
            form.setFieldsValue({
              description: item?.description,
              contents: item?.content,
            });
          } else if (
            localDoc?.type === 'PROTOTYPE' ||
            localDoc?.type === 'PRODUCT'
          ) {
            if (item.fileUrl) {
              const prefix = 'source-code/';
              const index = item.fileUrl.indexOf(prefix);
              const key = index !== -1 ? item.fileUrl.substring(index) : '';
              const headers = await getHeaders();
              try {
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
                  setPrototypeFiles(result.data.files);
                  setPrototypeSourceUrl(item.currentVersionUrl);
                } else {
                  message.error('Error fetching history versions.');
                }
              } catch (error) {
                console.error('Error fetching prototype history:', error);
                message.error('Error loading prototype history.');
              }
            }
          }
          setCurrentImage(null);

          // track event
          trackEvent('viewDocHistory', {
            distinct_id: user.email,
            payload: JSON.stringify({
              documentId: localDoc?.id,
              documentType: localDoc?.type,
              name: localDoc?.name,
              versionNumber,
            }),
          });
        }}
        onRefetchDocument={refetchDocument}
        isHistoryOpen={isHistoryOpen}
        onHistoryOpenChange={setIsHistoryOpen}
      />
    </Form>
  );
}

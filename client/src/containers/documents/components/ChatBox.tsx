import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircleOutlined,
  CheckOutlined,
  CloudUploadOutlined, EditOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  MenuOutlined,
  PlusOutlined,
  SendOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { ChatSessionTargetEntityType, DOCTYPE } from '@prisma/client';
import {
  Button,
  Flex,
  Input,
  message,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { TextAreaProps } from 'antd/es/input';
import * as pdfjsLib from 'pdfjs-dist';

import { useAppModal } from '../../../common/components/AppModal';
import {
  getAIAgentIntroMessage,
  getAIAgentSampleInputs,
  PRODUCT_TYPE_FULLSTACK,
  PROTOTYPE_TYPE_FRONTEND,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useProjectQuery } from '../../../common/hooks/useProjectsQuery';
import { ReactComponent as AiAvatar } from '../../../common/icons/ai-avatar.svg';
import { ReactComponent as AiGenerationButton } from '../../../common/icons/ai-generation-button.svg';
import { ReactComponent as Pen } from '../../../common/icons/pen.svg';
import { getHeaders } from '../../../common/util/apiHeaders';
import {
  checkIsGenerationLocked,
  getOutOfCreditTitle,
  getParagraphsFromWordFile,
} from '../../../common/util/app';
import { getFileIcon } from '../../../common/util/fileIcon';
import { GlobalStoreInst } from '../../../common/util/globalStore';
import { api_url, COLORS } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { DevPlanOutput } from '../../devPlans/types/devPlanTypes';
import { simplePresignUpload } from '../api/filesApi';
import { useDocumentChatHistory } from '../hooks/useDocument';
import { useUpdateDocumentMutation } from '../hooks/useDocumentMutation';
import { DocumentOutput } from '../types/documentTypes';
import ChatRecords, { ChatRecord, UserType } from './ChatRecords';

import './ChatBox.scss';

export interface IHandleCommand {
  e: React.MouseEvent<HTMLButtonElement> | React.ChangeEvent<HTMLInputElement>;
  command: ChatInputBoxCommand;
  payload: ChatInputBoxPayload;
}

export interface FileItem {
  fileName: string;
  fileUrl: string;
  id: number;
  documentId: string;
  fileBlob: File | null;
  uploadStatus?: 'uploading' | 'done';
}

export interface FileContent {
  fileContent: string; // For images: base64 data URL; for other files: text content
  fileType: string;
  fileId: string;
  s3Url?: string; // S3 URL for images, to be used by LLM in generated code
}

export enum ChatInputBoxCommand {
  GENERATE,
  CHOOSE_DOC,
}

export interface ChatInputBoxPayload {
  chosenDocumentIds: string[];
  fileContentList: FileContent[];
  chatContent: string;
  chatSessionId: string;
}

export type ChatInputBoxProps = TextAreaProps & {
  isGeneratingDoc: boolean;
  isStreaming: boolean;
  doc: DocumentOutput | DevPlanOutput;
  currentImage: string;
  selectedTemplateId: string;
  onCommand: (
    command: IHandleCommand['command'],
    payload: ChatInputBoxPayload
  ) => void;
  onSaveDatabaseSettings: (settings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  }) => Promise<void>;
  disableSend?: boolean;
  setTriggerGenerateDocumentFromError?: (
    fn: (chatContentOverride: string) => void
  ) => void;
  setAppendToChatRecordsFn?: (fn: (record: ChatRecord) => void) => void;
  setCurrentImage?: (image: string | null) => void;
  handleConvertToApp?: (
    conversionType?:
      | typeof PROTOTYPE_TYPE_FRONTEND
      | typeof PRODUCT_TYPE_FULLSTACK
  ) => void;
  onPublish?: () => void;
  onOpenSettingsModal?: (initialTab?: string) => void; // Function to open settings modal with specific tab
  isChatBoxCollapsed?: boolean; // External control for chat collapse
  onChatBoxCollapseChange?: (collapsed: boolean) => void; // Callback when collapse state changes
  visualEditEnabled?: boolean;
  visualEditReady?: boolean;
  onVisualEditToggle?: (enabled: boolean) => void;
};

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('reader error'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load error'));
      img.onload = () => {
        const MAX_WIDTH = 800;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context error'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Convert SVG to PNG for LLM (Anthropic doesn't support SVG format)
// This converts SVG to PNG without compression to preserve quality
async function convertSvgToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('reader error'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load error'));
      img.onload = () => {
        // Use image's natural dimensions (SVG will have its viewBox dimensions)
        // If dimensions are 0 or invalid, use reasonable defaults
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context error'));
          return;
        }
        // Draw SVG to canvas - this rasterizes the SVG to PNG
        ctx.drawImage(img, 0, 0, width, height);
        // Convert to PNG format (not JPEG) to preserve quality, no compression
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Counter for generating unique file IDs
let fileIdCounter = 0;

export function ChatBox({
  isGeneratingDoc,
  isStreaming,
  placeholder,
  doc,
  currentImage,
  selectedTemplateId,
  onCommand,
  onSaveDatabaseSettings,
  disableSend = false,
  setTriggerGenerateDocumentFromError,
  setAppendToChatRecordsFn,
  setCurrentImage,
  handleConvertToApp,
  onPublish,
  onOpenSettingsModal,
  isChatBoxCollapsed: externalIsChatBoxCollapsed,
  onChatBoxCollapseChange,
  visualEditEnabled = false,
  visualEditReady = false,
  onVisualEditToggle,
}: ChatInputBoxProps) {
  const { user, organization } = useCurrentUser();
  const { t, language } = useLanguage();
  const { data: project } = useProjectQuery(doc?.projectId);

  // A temporary fix to stale chat state. I would prefer to use SSE.
  const { data: initialHistoryRecords, isLoading } = useDocumentChatHistory(
    doc.id
  );

  const { showAppModal } = useAppModal();
  const showAppModalRef = useRef(showAppModal);
  showAppModalRef.current = showAppModal;
  const [chatRecords, setChatRecords] = useState<ChatRecord[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const [fileContentList, setFileContentList] = useState<FileContent[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [chatContent, setChatContent] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  const [isInjectingFeature, setIsInjectingFeature] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [internalIsChatBoxCollapsed, setInternalIsChatBoxCollapsed] =
    useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isChatBoxCollapsed =
    externalIsChatBoxCollapsed !== undefined
      ? externalIsChatBoxCollapsed
      : internalIsChatBoxCollapsed;
  const setIsChatBoxCollapsed = (collapsed: boolean) => {
    if (onChatBoxCollapseChange) {
      onChatBoxCollapseChange(collapsed);
    } else {
      setInternalIsChatBoxCollapsed(collapsed);
    }
  };
  const hasAutoSentRef = useRef(false); // Guard to prevent duplicate auto-send
  const { updateDocumentMutation } = useUpdateDocumentMutation({
    onSuccess: (updatedDoc) => {
      console.log('Document meta updated successfully');
    },
  });
  const outerDivRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatSessionId = useRef('');
  const documentId = doc.id;
  const isGenerationLocked = checkIsGenerationLocked(organization);
  const hasInitalChatHistoryBeenChecked = useRef(false);
  const isManualResetRef = useRef(false);
  const isBusy = isGeneratingDoc || isStreaming || isThinking;

  // Auto-focus on textarea when component mounts or document type changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [doc.type]); // Re-run when document type changes

  // Create a ref to store the sendMessageToAI function
  const sendMessageToAIRef = useRef<
    ((initContent?: string) => Promise<void>) | null
  >(null);

  const handleGenerate = useCallback(async () => {
    if (isGeneratingDoc) {
      message.error(t('document.generationInProgress'));
      return;
    }

    // Check if any files are still uploading
    const hasUploadingFiles = fileList.some(
      (item) => item.uploadStatus === 'uploading'
    );
    if (hasUploadingFiles) {
      message.warning(t('document.filesStillUploading'));
      return;
    }

    if (isGenerationLocked) {
      showAppModalRef.current({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'documentEditor',
          destination: `generate:${doc?.type}`,
          isLowCredits: true, // User is low on credits
        },
      });
      return;
    }
    // Images are already in fileContentList with s3Url field from upload
    // No need to process them again here
    const enhancedFileContentList = fileContentList;

    // Auto-add PRD document ID to chosenDocumentIds for PROTOTYPE/PRODUCT generation
    let chosenDocumentIds: string[] = [];
    if (doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT) {
      const prdDoc = project?.documents?.find((d) => d.type === DOCTYPE.PRD);
      if (prdDoc?.id) {
        chosenDocumentIds = [prdDoc.id];
      }
    }

    onCommand(ChatInputBoxCommand.GENERATE, {
      chosenDocumentIds: chosenDocumentIds,
      fileContentList: enhancedFileContentList,
      chatContent: chatContent,
      chatSessionId: chatSessionId.current,
    });
  }, [
    chatContent,
    doc,
    fileContentList,
    fileList,
    isGeneratingDoc,
    onCommand,
    isGenerationLocked,
    user.email,
    t,
    project?.documents,
  ]);

  const sendMessageToAI = useCallback(
    async (initContent: string = '') => {
      let genContent = chatContent.trim() || initContent;
      if (genContent === '') {
        message.error(t('document.chatContentEmpty'));
        return;
      }

      if (isLoading) {
        message.error(t('document.loadingChatHistoryError'));
        return;
      }

      // Check if any files are still uploading
      const hasUploadingFiles = fileList.some(
        (item) => item.uploadStatus === 'uploading'
      );
      if (hasUploadingFiles) {
        message.warning(t('document.filesStillUploading'));
        return;
      }

      if (isGenerationLocked) {
        showAppModalRef.current({
          type: 'updateSubscription',
          payload: {
            email: user.email,
            source: 'ChatBox',
            destination: `Chat:${doc?.type}`,
            isLowCredits: true, // User is low on credits
          },
        });
        return;
      }

      const updatedChatRecords = [
        ...chatRecords,
        {
          type: UserType.HUMAN,
          message: genContent,
        },
      ];
      setChatRecords(updatedChatRecords);
      setChatContent('');
      // Clear file lists after sending message
      setFileList([]);
      setFileContentList([]);
      setCurrentImage?.(null);
      setIsThinking(true);

      try {
        const headers = await getHeaders();

        // Auto-add PRD document ID to chosenDocumentIds for PROTOTYPE/PRODUCT generation
        let chosenDocumentIds = '';
        if (doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT) {
          const prdDoc = project?.documents?.find(
            (d) => d.type === DOCTYPE.PRD
          );
          if (prdDoc?.id) {
            chosenDocumentIds = prdDoc.id;
          }
        }

        // Add timeout to prevent indefinite hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        const result = await fetch(`${api_url}/api/chats/message`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            entityId: documentId,
            entityType: ChatSessionTargetEntityType.DOCUMENT,
            entitySubType: doc?.type || '',
            name: doc?.name || '',
            description: genContent || doc?.description || '',
            projectId: doc?.projectId,
            contents: doc?.contents,
            imageBase64: currentImage,
            templateId: selectedTemplateId,
            uploadedFileContent: fileContentList,
            chosenDocumentIds: chosenDocumentIds,
            chatSessionId: chatSessionId.current,
            language, // Pass language for stop message translation
          }),
        });

        clearTimeout(timeoutId);

        if (!result.ok) {
          const errorMessage = await result.text().catch(() => 'Unknown error');
          throw new Error(
            `Request failed with status ${result.status}: ${errorMessage}`
          );
        }

        trackEvent('chatMessage', {
          distinct_id: user.email,
          payload: JSON.stringify({
            userEmail: user.email,
            docType: doc.type,
            chatSessionId: chatSessionId.current,
            chatContent,
          }),
        });

        const { success, data, errorMsg } = await result.json();

        if (!success) {
          message.error('Error loading document: ' + errorMsg);
          return;
        }
        console.log('ai response: ', data);
        setChatRecords([
          ...updatedChatRecords,
          {
            type: UserType.AI,
            message: data.message,
          },
        ]);
        chatSessionId.current = data.chatSessionId;

        if (data.intent === 'DOCUMENT') {
          handleGenerate();
        }
      } catch (error) {
        console.error('Error sending message:', error);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            message.error(
              t('document.requestTimeout') ||
                'Request timed out. Please try again.'
            );
          } else {
            message.error(
              t('document.chatError') ||
                'Error sending message: ' + error.message
            );
          }
        } else {
          message.error(
            t('document.chatError') ||
              'Error sending message. Please try again.'
          );
        }
      } finally {
        setIsThinking(false);
      }
    },
    [
      chatContent,
      currentImage,
      doc,
      chatRecords,
      documentId,
      project?.documents,
      fileContentList,
      fileList,
      user.email,
      handleGenerate,
      isLoading,
      selectedTemplateId,
      isGenerationLocked,
      language,
      t,
      setCurrentImage,
    ]
  );

  // Update the ref with the sendMessageToAI function
  useEffect(() => {
    sendMessageToAIRef.current = sendMessageToAI;
  }, [sendMessageToAI]);

  const updateDocumentFeature = useCallback(
    async (featureType: string) => {
      try {
        const featureKey =
          featureType === 'authentication'
            ? 'hasAuth'
            : featureType === 'ai'
              ? 'hasAI'
              : featureType === 'domain'
                ? 'hasDomain'
                : null;

        if (!featureKey) return;

        console.log('Current doc.meta:', doc.meta);

        const updatedMeta = {
          ...((doc.meta as Record<string, any>) || {}),
          features: {
            ...((doc.meta as any)?.features || {}),
            [featureKey]: true,
          },
        };

        console.log('Updated meta:', updatedMeta);

        await updateDocumentMutation.mutateAsync({
          id: doc.id,
          meta: updatedMeta,
        });

        console.log('Document meta updated successfully');
      } catch (error) {
        console.error('Failed to update document meta:', error);
      }
    },
    [doc.id, doc.meta, updateDocumentMutation]
  );

  const handleFeatureInjection = useCallback(
    async (featureType: string) => {
      if (isInjectingFeature) return;

      setIsInjectingFeature(true);
      try {
        // Create the feature injection request
        const featureMessage = `Add ${featureType} functionality to this app. Please generate the necessary files and integrate them with the existing codebase.`;

        // Wait for chat history to load if it's still loading
        if (isLoading) {
          message.info(t('document.waitForChatHistory'));
          return;
        }

        // Store the current chat content to restore it later
        const currentChatContent = chatContent;

        // Use sendMessageToAI to trigger the streaming generation
        if (sendMessageToAIRef.current) {
          await sendMessageToAIRef.current(featureMessage);

          // Update document meta to mark feature as added
          await updateDocumentFeature(featureType);
        }

        // Restore the original chat content after a short delay
        // This allows the streaming to start but preserves the user's input
        setTimeout(() => {
          setChatContent(currentChatContent);
        }, 100);
      } catch (error) {
        console.error('Feature injection error:', error);
        message.error('Failed to add feature. Please try again.');
      } finally {
        setIsInjectingFeature(false);
      }
    },
    [isInjectingFeature, isLoading, chatContent, updateDocumentFeature, t]
  );

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
    if (setAppendToChatRecordsFn) {
      setAppendToChatRecordsFn((record: ChatRecord) => {
        setChatRecords((prev) => [...prev, record]);
      });
    }
  }, [setAppendToChatRecordsFn]);

  // Handle stop generation directly in ChatBox
  const handleStopGeneration = useCallback(async () => {
    if (isStopping) return; // Prevent multiple clicks

    setIsStopping(true);

    try {
      const headers = await getHeaders();
      const response = await fetch(`${api_url}/api/documents/stop-generation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documentId,
          chatSessionId: chatSessionId.current,
          language, // Pass current language
        }),
      });
      console.log('Stop signal sent to server');

      // Get the returned chat message and append to chat immediately
      const result = await response.json();
      if (result.success && result.data.chatMessage) {
        setChatRecords((prev) => [
          ...prev,
          {
            type: UserType.AI,
            message: result.data.chatMessage,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to send stop signal:', error);
      // Even if server fails, still trigger local cancel to stop UI
    } finally {
      try {
        window.dispatchEvent(
          new CustomEvent('cancel-document-generation', {
            detail: { documentId },
          })
        );
      } catch {}
      // Let the isStopping flag reset when UI actually stops; in case nothing changes, fallback reset after short delay
      setIsThinking(false);
      setTimeout(() => {
        setIsStopping(false);
      }, 1500);
    }
  }, [documentId, isStopping, language]);

  // Reset isStopping when generation actually stops
  useEffect(() => {
    if (isStopping && !isGeneratingDoc && !isStreaming && !isThinking) {
      setIsStopping(false);
    }
  }, [isStopping, isGeneratingDoc, isStreaming, isThinking]);

  useEffect(() => {
    if (shouldAutoSend && !hasAutoSentRef.current) {
      // Guard: Prevent duplicate auto-send
      if (isGeneratingDoc || isStreaming || isThinking) {
        // Generation already in progress, don't trigger again
        setShouldAutoSend(false);
        return;
      }

      hasAutoSentRef.current = true; // Mark as sent to prevent duplicates
      setShouldAutoSend(false); // 避免二次触发

      if (isGenerationLocked) {
        showAppModalRef.current({
          type: 'updateSubscription',
          payload: {
            email: user.email,
            source: 'ChatBox',
            destination: `Chat:sendMessageToAI`,
            isLowCredits: true, // User is low on credits
          },
        });
        hasAutoSentRef.current = false; // Reset if locked
        return;
      }
      sendMessageToAI(chatContent);
    }
  }, [
    shouldAutoSend,
    chatContent,
    sendMessageToAI,
    isGenerationLocked,
    user.email,
    doc?.type,
    isGeneratingDoc,
    isStreaming,
    isThinking,
  ]);

  const triggerGenerateDocumentFromError = useCallback(
    async (chatContentOverride: string) => {
      if (isGeneratingDoc) {
        message.error(t('document.generationInProgress'));
        return;
      }

      if (isGenerationLocked) {
        showAppModalRef.current({
          type: 'updateSubscription',
          payload: {
            email: user.email,
            source: 'documentEditor',
            destination: `generate:${doc?.type}`,
            isLowCredits: true, // User is low on credits
          },
        });
        return;
      }

      const finalChatContent = chatContentOverride || chatContent;
      // set chatContent to finalChatContent
      setChatContent(finalChatContent);
      // enable auto send message to AI
      setShouldAutoSend(true);
      // set isFixingDeploymentError to true in GlobalStoreInst
      GlobalStoreInst.set('isFixingDeploymentError', true);
    },
    [chatContent, doc, isGeneratingDoc, isGenerationLocked, user.email, t]
  );

  useEffect(() => {
    if (setTriggerGenerateDocumentFromError) {
      setTriggerGenerateDocumentFromError(triggerGenerateDocumentFromError);
    }
  }, [setTriggerGenerateDocumentFromError, triggerGenerateDocumentFromError]);

  useEffect(() => {
    hasInitalChatHistoryBeenChecked.current = false;
    hasAutoSentRef.current = false; // Reset auto-send guard when document changes
    setChatContent('');
  }, [doc.id]);

  useEffect(() => {
    if (isLoading) return;
    if (!hasInitalChatHistoryBeenChecked.current) {
      if (isManualResetRef.current) {
        isManualResetRef.current = false;
        hasInitalChatHistoryBeenChecked.current = true;
        return;
      }
      const autoGenDocId = GlobalStoreInst.get('autoGenerateDocForPRD');
      const fileInfo = GlobalStoreInst.get('uploadedFileInfoForPRD');
      const uploadedText = fileInfo?.uploadedText || '';
      const uploadedFileName = fileInfo?.uploadedFilename || '';
      const uploadedFileType = fileInfo?.uploadedFileType || '';
      const isImage = fileInfo?.isImage || false;

      const content =
        doc.type === DOCTYPE.PROTOTYPE
          ? t('document.createPrototype')
          : doc.type === DOCTYPE.PRODUCT
            ? t('document.createProduct')
            : doc.description || '';

      // 构造并设置
      if (uploadedText) {
        setFileContentList([
          {
            fileType: isImage ? 'image' : uploadedFileType,
            fileContent: uploadedText,
            fileId: uploadedFileName,
          },
        ]);
      }

      if (uploadedFileName) {
        const length = fileContentList.length;
        setFileList([
          {
            fileName: uploadedFileName,
            fileUrl: '',
            id: length + 1,
            documentId: '',
            fileBlob: null,
          },
        ]);
      }

      setChatRecords(initialHistoryRecords);
      if (!initialHistoryRecords.length) {
        setChatContent(content);
        if (autoGenDocId && !hasAutoSentRef.current) {
          // Guard: Only trigger if not already sent and not currently generating
          if (!isGeneratingDoc && !isStreaming && !isThinking) {
            GlobalStoreInst.set('autoGenerateDocForPRD', '');
            // Don't set hasAutoSentRef here - let the auto-send useEffect handle it
            setShouldAutoSend(true); // 延迟触发
            // track event
            trackEvent('generatePRD', {
              distinct_id: user.email,
              payload: JSON.stringify({
                documentId: autoGenDocId,
                documentType: doc.type,
                source: 'homePageBuildProjectTrigger',
                description: doc.description,
                chatContent: chatContent,
              }),
            });
          } else {
            // Generation already in progress, clear flag but don't trigger
            GlobalStoreInst.set('autoGenerateDocForPRD', '');
          }
        }
      } else {
        GlobalStoreInst.set('autoGenerateDocForPRD', '');
        setChatContent('');
      }

      // 清除 global 临时数据
      GlobalStoreInst.set('uploadedFileInfoForPRD', '');
      hasInitalChatHistoryBeenChecked.current = true;
    }
  }, [
    isLoading,
    doc.id,
    initialHistoryRecords,
    doc.description,
    doc.type,
    sendMessageToAI,
    fileContentList.length,
    isGeneratingDoc,
    isStreaming,
    isThinking,
    chatContent,
    t,
    user.email,
  ]);

  const isRightFileType = (file: File) => {
    const mimeType = file.type;

    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (
      mimeType === 'application/msword' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return '.docx';
    } else if (mimeType === 'application/pdf') {
      return 'pdf';
    } else if (mimeType === 'text/plain') {
      return 'txt';
    } else {
      return 'others';
    }
  };

  const handleChooseMyFile = async (file: File) => {
    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      message.error(t('document.fileTooLarge'));
      return;
    }

    const fileType = isRightFileType(file);
    if (fileType === 'others') {
      message.error('Please upload image, word, txt or pdf files.');
      return;
    }
    if (
      doc.type !== DOCTYPE.UI_DESIGN &&
      doc.type !== DOCTYPE.PROTOTYPE &&
      doc.type !== DOCTYPE.PRODUCT &&
      doc.type !== DOCTYPE.PRD &&
      fileType === 'image'
    ) {
      message.error('Please upload .docx, txt or pdf files.');
      return;
    }

    const fileOriginalName = file.name;
    let fileResult = '';

    // Add file to list immediately with uploading status
    // Generate unique ID by combining timestamp with counter
    const newFileId = Date.now() + fileIdCounter++;
    setFileList((prevList) => [
      {
        fileName: fileOriginalName,
        fileUrl: '',
        id: newFileId,
        documentId: '',
        fileBlob: file,
        uploadStatus: 'uploading',
      },
      ...prevList,
    ]);
    if (fileType === '.docx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        const paragraphs = getParagraphsFromWordFile(content);
        console.log('paragraphs:', paragraphs);
        fileResult = paragraphs.join('\n\n');
      };

      reader.onloadend = () => {
        console.log('fileResult:', fileResult);

        setFileContentList((prevList) => [
          {
            fileType: '.docx',
            fileContent: 'This is a word document: \n' + fileResult,
            fileId: fileOriginalName,
          },
          ...prevList,
        ]);

        // Update file status to done
        setFileList((prevList) =>
          prevList.map((item) =>
            item.id === newFileId ? { ...item, uploadStatus: 'done' } : item
          )
        );
      };

      reader.onerror = (err) => {
        console.error(err);
        // Remove file from list on error
        setFileList((prevList) =>
          prevList.filter((item) => item.id !== newFileId)
        );
        message.error(t('document.uploadError'));
      };

      reader.readAsArrayBuffer(file);
    }
    if (fileType === 'pdf') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
      const loadingTask = pdfjsLib.getDocument({
        data: await file.arrayBuffer(),
      });
      const pdf = await loadingTask.promise;
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const textContent = await page.getTextContent();

        const textItems = textContent.items
          .map((item) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ');
        fileResult += textItems + '\n\n';
      }

      setFileContentList((prevList) => [
        {
          fileType: 'pdf',
          fileContent: 'This is a pdf document: \n' + fileResult,
          fileId: fileOriginalName,
        },
        ...prevList,
      ]);
    }

    if (fileType === 'image') {
      try {
        // Check if file is SVG - SVG files should not be compressed
        const isSvg =
          file.type === 'image/svg+xml' ||
          file.name.toLowerCase().endsWith('.svg');

        // Read the file as base64 for LLM (fileContent)
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            let fileContentForLLM: string; // Base64 for LLM (compressed for non-SVG, PNG for SVG)

            if (isSvg) {
              // For SVG files, convert to PNG (Anthropic API doesn't support SVG format)
              // This is format conversion, not compression - preserves quality
              fileContentForLLM = await convertSvgToPng(file);
            } else {
              // For other images, compress for LLM (to reduce API costs)
              fileContentForLLM = await compressImageFile(file);
            }

            // Upload original file to S3 (not compressed)
            let s3Url = '';
            try {
              // Use simple-presign-upload for efficient direct S3 upload
              const { uploadUrl, publicUrl } = await simplePresignUpload({
                documentId: doc.id,
                fileName: `image-${Date.now()}.${file.name.split('.').pop()}`,
                fileType: file.type || (isSvg ? 'image/svg+xml' : 'image/png'),
              });

              // Upload original file directly to S3 (not compressed)
              const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type':
                    file.type || (isSvg ? 'image/svg+xml' : 'image/png'),
                },
                body: file, // Upload original file
              });

              if (!uploadResponse.ok) {
                throw new Error('Upload to S3 failed');
              }
              s3Url = publicUrl;
            } catch (uploadError) {
              console.error('S3 upload error:', uploadError);
              // Remove file from list on upload failure
              setFileList((prevList) =>
                prevList.filter((item) => item.id !== newFileId)
              );
              message.error(
                t('document.imageUploadFailed') ||
                  'Failed to upload image to server. Please try again.'
              );
              return; // Exit early - do not add to fileContentList
            }

            // Only add to fileContentList if S3 upload succeeded
            if (!s3Url) {
              setFileList((prevList) =>
                prevList.filter((item) => item.id !== newFileId)
              );
              message.error(t('document.imageUploadFailed'));
              return;
            }

            // Use functional update to ensure we have the latest state
            setFileContentList((prevList) => [
              {
                fileType: 'image',
                fileContent: fileContentForLLM, // Compressed base64 for LLM (or original for SVG)
                fileId: fileOriginalName,
                s3Url: s3Url, // S3 URL pointing to original file
              },
              ...prevList,
            ]);

            // Update file status to done
            setFileList((prevList) =>
              prevList.map((item) =>
                item.id === newFileId ? { ...item, uploadStatus: 'done' } : item
              )
            );

            // Set currentImage to the base64 data for logo change detection
            // Use compressed version for non-SVG, original for SVG
            setCurrentImage?.(fileContentForLLM);
          } catch (compressError) {
            console.error('Image processing error:', compressError);
            // Remove file from list on error
            setFileList((prevList) =>
              prevList.filter((item) => item.id !== newFileId)
            );
            message.error(
              t('document.imageCompressionFailed') ||
                'Failed to process image. Please try again.'
            );
          }
        };
        reader.onerror = () => {
          // Remove file from list on error
          setFileList((prevList) =>
            prevList.filter((item) => item.id !== newFileId)
          );
          message.error(t('document.uploadError'));
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Image processing error:', err);
        // Remove file from list on error
        setFileList((prevList) =>
          prevList.filter((item) => item.id !== newFileId)
        );
        message.error(t('document.uploadError'));
      }
    }

    if (fileType === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        fileResult = e.target?.result as string;
      };

      reader.onloadend = () => {
        setFileContentList((prevList) => [
          {
            fileType: 'txt',
            fileContent: 'This is a text document: \n' + fileResult,
            fileId: fileOriginalName,
          },
          ...prevList,
        ]);

        // Update file status to done
        setFileList((prevList) =>
          prevList.map((item) =>
            item.id === newFileId ? { ...item, uploadStatus: 'done' } : item
          )
        );
      };

      reader.onerror = (err) => {
        console.error(err);
        // Remove file from list on error
        setFileList((prevList) =>
          prevList.filter((item) => item.id !== newFileId)
        );
        message.error(t('document.uploadError'));
      };

      reader.readAsText(file);
    }

    // For PDF files, update status to done after processing
    if (fileType === 'pdf') {
      setFileList((prevList) =>
        prevList.map((item) =>
          item.id === newFileId ? { ...item, uploadStatus: 'done' } : item
        )
      );
    }
  };

  const handleDeleteFile = (paramItem: FileItem) => {
    const updatedFileList = fileList.filter((item) => item.id !== paramItem.id);
    const updatedFileContentList = fileContentList.filter(
      (item) => item.fileId !== paramItem.fileName
    );
    setFileList(updatedFileList);
    setFileContentList(updatedFileContentList);
  };

  const handleInputChange = (
    e: React.FocusEvent<HTMLTextAreaElement, Element>
  ) => {
    setChatContent(e.target.value);
  };

  const sampleInputs = getAIAgentSampleInputs(doc.type, t);
  const introMsg = getAIAgentIntroMessage(doc.type, t);

  // Check if document has content (is generated)
  const isDocumentGenerated =
    !isGeneratingDoc &&
    !isStreaming &&
    doc.contents &&
    doc.contents.trim().length > 0;

  const isPrototype = doc.type === DOCTYPE.PROTOTYPE;

  // Handle file upload trigger
  const handleUploadClick = () => {
    const uploadInput = outerDivRef.current?.closest('.ant-upload-wrapper');
    const fileInput =
      uploadInput?.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput) {
      fileInput.click();
    }
    setShowUploadMenu(false);
  };

  // If collapsed and prototype, show minimal collapsed view
  if (isChatBoxCollapsed && isPrototype) {
    return (
      <Flex
        vertical
        style={{
          height: '100%',
          justifyContent: 'flex-start',
          position: 'relative',
          alignItems: 'center',
          paddingTop: '10px',
        }}
      >
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setIsChatBoxCollapsed(false)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
          }}
        />
      </Flex>
    );
  }

  return (
    <Flex
      vertical
      style={{
        height: '100%',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <Flex vertical style={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <Flex
          style={{ alignItems: 'center', position: 'relative' }}
          className="editor-title"
        >
          <AiAvatar style={{ width: '21px', height: '21px' }} />
          <Typography.Title level={5} style={{ margin: 0, marginLeft: '8px' }}>
            JOY
          </Typography.Title>
        </Flex>
        <ChatRecords
          isThinking={isThinking}
          isLoaded={!isLoading}
          records={chatRecords}
          introMsg={introMsg}
        />
        {!chatRecords?.length && !isLoading && (
          <Flex vertical>
            <Flex
              style={{
                margin: '8px 0',
                alignItems: 'center',
                borderTop: 'solid 1px #eee',
                paddingTop: '10px',
                boxShadow: '0 -5px 5px -5px #eee',
              }}
            >
              <Pen />
              <Typography.Title
                level={5}
                style={{ marginLeft: '4px', margin: 0, fontSize: 14 }}
              >
                {t('document.pickSamplePrompt')}
              </Typography.Title>
            </Flex>
            <Flex className="sample-input-container">
              {sampleInputs?.map((item, index) => (
                <Typography.Text
                  ellipsis
                  key={index}
                  className="sample-item"
                  onClick={() => {
                    setChatContent(item);
                  }}
                >
                  {item}
                </Typography.Text>
              ))}
            </Flex>
          </Flex>
        )}
      </Flex>
      <Upload
        name="file"
        showUploadList={false}
        multiple={true}
        beforeUpload={(file) => {
          handleChooseMyFile(file);
          return false; // Prevent auto upload
        }}
        openFileDialogOnClick={false}
        className="chat-upload-wrapper"
      >
        <Flex
          vertical={isMobile ? false : true}
          className="user-input-container"
          align={isMobile ? 'end' : ''}
          ref={outerDivRef}
          style={{ padding: isMobile ? 7 : 4 }}
        >
          {fileList && fileList.length > 0 && (
            <Flex
              wrap="wrap"
              gap="8px"
              style={{
                padding: '10px 5px 5px 5px',
                borderRadius: '8px',
                backgroundColor: COLORS.LIGHT_GRAY,
              }}
            >
              {fileList.map((item) => {
                return (
                  <Tag
                    className="file-tag"
                    closable={item.uploadStatus !== 'uploading'}
                    key={item.id}
                    onClose={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteFile(item);
                    }}
                  >
                    <Tooltip title={item.fileName}>
                      <Typography.Text ellipsis className="file-label">
                        {item.uploadStatus === 'uploading' && (
                          <LoadingOutlined style={{ color: '#1890ff' }} />
                        )}
                        {item.uploadStatus === 'done' && (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        )}
                        {getFileIcon(item.fileName?.split('.')?.pop() || '')}
                        {item.fileName}
                      </Typography.Text>
                    </Tooltip>
                  </Tag>
                );
              })}
            </Flex>
          )}
          <Input.TextArea
            ref={textareaRef}
            autoSize={{ minRows: isMobile ? 1 : 5, maxRows: isMobile ? 3 : 10 }}
            value={chatContent}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="chat-box-input"
            style={{
              width: '100%',
              fontSize: '13px',
              border: 'none',
              top: '0px',
              paddingLeft: isMobile ? 0 : 4,
              paddingBottom: isMobile ? 25 : 25,
              paddingRight: isMobile ? 35 : 40,
              marginBottom: isMobile ? 2 : 0,
            }}
          />
          <Flex>
            <Flex>
              {isBusy ? (
                // Show stop button when generating or thinking
                <Tooltip
                  title={
                    isStopping
                      ? t('document.stopping')
                      : t('document.stopGeneration')
                  }
                >
                  <button
                    style={{
                      border: 'none',
                      padding: 0,
                      margin: 1,
                      height: isMobile ? 28 : 24,
                      width: isMobile ? 28 : 24,
                      position: 'absolute',
                      right: 5,
                      bottom: 3,
                      borderRadius: '50%',
                      backgroundColor: '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isStopping ? 'not-allowed' : 'pointer',
                      opacity: isStopping ? 0.5 : 1,
                      transition: 'background-color 0.2s, opacity 0.2s',
                    }}
                    onClick={handleStopGeneration}
                    disabled={isStopping}
                    className="chat-stop-btn"
                    onMouseEnter={(e) => {
                      if (!isStopping) {
                        e.currentTarget.style.backgroundColor = '#5a5a5a';
                      }
                    }}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = '#757575')
                    }
                  >
                    <div
                      style={{
                        width: isMobile ? '10px' : '8px',
                        height: isMobile ? '10px' : '8px',
                        backgroundColor: 'white',
                        borderRadius: '1px',
                      }}
                    />
                  </button>
                </Tooltip>
              ) : (
                // Show send button when not generating
                <Button
                  size="small"
                  type={isMobile ? 'text' : 'default'}
                  style={{
                    border: 'none',
                    padding: 0,
                    margin: 1,
                    height: isMobile ? 28 : 24,
                    width: isMobile ? 28 : 'auto',
                    position: 'absolute',
                    right: 0,
                    bottom: 3,
                  }}
                  onClick={(e) => {
                    sendMessageToAI();
                  }}
                  className="chat-submit-btn"
                  disabled={disableSend}
                >
                  {isMobile ? (
                    <SendOutlined
                      style={{ fontSize: '16px', color: '#757575' }}
                    />
                  ) : (
                    <AiGenerationButton />
                  )}
                </Button>
              )}

              {isGenerationLocked && (
                //<Tooltip title="Insufficient credits. Please buy more credits or upgrade.">
                <Tooltip title={getOutOfCreditTitle(organization, t)}>
                  <InfoCircleOutlined
                    style={{ color: 'orange' }}
                    onClick={handleGenerate}
                  />
                  &nbsp;&nbsp;
                </Tooltip>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Upload>

      {/* Plus icon and Settings icon - positioned at bottom left, aligned with send button */}
      <Flex
        style={{
          position: 'absolute',
          bottom: '3px',
          left: '10px',
          gap: '8px',
          alignItems: 'center',
          zIndex: 10,
          marginBottom: '4px'
        }}
      >
        <Popover
          content={
            <Space
              className="chat-popover"
              direction="vertical"
              size="small"
              style={{ width: '100%' }}
            >
              <Button
                type="text"
                icon={<CloudUploadOutlined />}
                onClick={handleUploadClick}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  padding: '0px 8px',
                }}
              >
                {t('chat.uploadFileAction')}
              </Button>
              {doc.type === DOCTYPE.PRODUCT && (
                <>
                  <Button
                    type="text"
                    icon={
                      (doc.meta as any)?.features?.hasAuth ? (
                        <CheckOutlined />
                      ) : (
                        <PlusOutlined />
                      )
                    }
                    onClick={() => {
                      handleFeatureInjection('authentication');
                      setShowUploadMenu(false);
                    }}
                    disabled={
                      !isDocumentGenerated ||
                      isInjectingFeature ||
                      isLoading ||
                      (doc.meta as any)?.features?.hasAuth
                    }
                    loading={isInjectingFeature}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      padding: '0px 8px',
                    }}
                  >
                    {t('document.auth')}
                  </Button>
                  <Button
                    type="text"
                    icon={
                      (doc.meta as any)?.features?.hasAI ? (
                        <CheckOutlined />
                      ) : (
                        <PlusOutlined />
                      )
                    }
                    onClick={() => {
                      setChatContent('add AI integration to ...');
                      setShowUploadMenu(false);
                    }}
                    disabled={
                      !isDocumentGenerated ||
                      isInjectingFeature ||
                      isLoading ||
                      (doc.meta as any)?.features?.hasAI
                    }
                    loading={isInjectingFeature}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      padding: '0px 8px',
                    }}
                  >
                    AI
                  </Button>
                  <Button
                    type="text"
                    icon={
                      (doc.meta as any)?.features?.hasDomain ? (
                        <CheckOutlined />
                      ) : (
                        <PlusOutlined />
                      )
                    }
                    onClick={() => {
                      if (onOpenSettingsModal) {
                        onOpenSettingsModal('domain');
                      } else {
                        handleFeatureInjection('domain');
                      }
                      setShowUploadMenu(false);
                    }}
                    disabled={
                      !isDocumentGenerated ||
                      isInjectingFeature ||
                      isLoading ||
                      (doc.meta as any)?.features?.hasDomain
                    }
                    loading={isInjectingFeature}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      padding: '0px 8px',
                    }}
                  >
                    {t('document.domain')}
                  </Button>
                </>
              )}
            </Space>
          }
          trigger="click"
          open={showUploadMenu}
          onOpenChange={setShowUploadMenu}
          placement="topLeft"
        >
          <Tooltip title={t('document.uploadFile') || 'Upload file'}>
            <Button
              type="text"
              icon={<PlusOutlined style={{ fontSize: '14px' }} />}
              style={{
                padding: '2px',
                minWidth: 'auto',
                height: 'auto',
                width: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        </Popover>
        {(doc.type === DOCTYPE.PROTOTYPE || doc.type === DOCTYPE.PRODUCT) &&
          onOpenSettingsModal && (
            <Tooltip
              title={
                doc.type === DOCTYPE.PROTOTYPE
                  ? t('toolbar.prototypeSettings')
                  : t('toolbar.productSettings')
              }
            >
              <Button
                type="text"
                icon={<SettingOutlined style={{ fontSize: '14px' }} />}
                onClick={() => onOpenSettingsModal()}
                style={{
                  padding: '2px',
                  minWidth: 'auto',
                  height: 'auto',
                  width: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.PRIMARY,
                }}
              />
            </Tooltip>
          )}

        {(doc.type === DOCTYPE.PROTOTYPE || doc.type === DOCTYPE.PRODUCT) &&
          onVisualEditToggle && (
              <Button
                className={`visual-edit-button ${visualEditEnabled ? 'visual-edit-button-active' : ''}`}
                type="default"
                icon={<EditOutlined style={{ fontSize: '14px' }} />}
                onClick={() => onVisualEditToggle(!visualEditEnabled)}
              >
                {t('toolbar.visualEdit')}
              </Button>
          )}
      </Flex>
    </Flex>
  );
}

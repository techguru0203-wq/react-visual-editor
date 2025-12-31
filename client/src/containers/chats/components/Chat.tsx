import { useEffect, useRef, useState } from 'react';
import { CloudUploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  Access,
  ChatSession,
  ChatSessionTargetEntityType,
  DOCTYPE,
} from '@prisma/client';
import {
  Button,
  Flex,
  Input,
  message,
  Spin,
  Tag,
  Tooltip,
  TreeDataNode,
  Typography,
  Upload,
} from 'antd';
import * as pdfjsLib from 'pdfjs-dist';
import { useNavigate, useParams } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import {
  AIAgentIntroMessage,
  AIAgentSampleInputs,
  PRODUCT_TYPE_FULLSTACK,
  PROTOTYPE_TYPE_FRONTEND,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
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
import ChatRecords, {
  ChatRecord,
  UserType,
} from '../../documents/components/ChatRecords';
import DocTreeNodes from '../../documents/components/DocTreeNodes';
import DocumentToolbar, {
  DocumentToolBarActions,
} from '../../documents/components/DocumentToolbar';
import { useDocumentMutation } from '../../documents/hooks/useDocumentMutation';
import { useUserDocuments } from '../../documents/hooks/useUserDocuments';
import { IdeasPath } from '../../nav/paths';
import { LegacyDocumentOutput } from '../../project/types/projectType';
import { useChatHistory, useUserChatSession } from '../hooks/useChat';

import './Chat.scss';

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
}

export interface FileContent {
  fileContent: string;
  fileType: string;
  fileId: string;
}

export enum ChatInputBoxCommand {
  GENERATE,
  CHOOSE_DOC,
}

export interface ChatInputBoxPayload {
  fileList: FileItem[];
  fileContentList: FileContent[];
  chatContent: string;
}

function useChatSessionIdParam(): string {
  const { chatSessionId } = useParams();
  if (!chatSessionId) {
    throw new Error('You must specify a chatSessionId parameter');
  }
  return chatSessionId;
}

export function Chat() {
  const { t } = useLanguage();
  const chatSessionId = useChatSessionIdParam();
  const { user, organization } = useCurrentUser();
  const { data: docs } = useUserDocuments(user.id);
  const { data: chatSessions } = useUserChatSession(user.id);
  const { data: initialHistoryRecords, isLoading } =
    useChatHistory(chatSessionId);
  const [selectedDocNodes, setSelectedDocNodes] = useState<TreeDataNode[]>([]);
  const { showAppModal } = useAppModal();
  const [chatRecords, setChatRecords] = useState<ChatRecord[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [fileContentList, setFileContentList] = useState<FileContent[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [chatContent, setChatContent] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const navigate = useNavigate();
  const { createDocumentMutation } = useDocumentMutation({
    onSuccess: (document: LegacyDocumentOutput) => {
      console.log('Successfully created app', document);
      setIsThinking(false);
      navigate(`/docs/${document.id}`);
    },
    onError: () => {
      console.error('error');
      setIsThinking(false);
    },
  });

  const outerDivRef = useRef<HTMLDivElement>(null);

  const chatSession = chatSessions?.find(
    (chat: ChatSession) => chat.id === chatSessionId
  );

  const isGenerationLocked = checkIsGenerationLocked(organization);

  useEffect(() => {
    if (!isLoading) {
      setChatRecords(initialHistoryRecords || []);
    }
  }, [isLoading, initialHistoryRecords]);

  useEffect(() => {
    if (successMessage) {
      setChatRecords([
        ...chatRecords,
        {
          type: UserType.AI,
          message: successMessage,
        },
      ]);
      setSuccessMessage('');
    }
  }, [successMessage, setChatRecords, chatRecords]);

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
    const fileType = isRightFileType(file);
    if (fileType === 'others') {
      message.error(t('chat.uploadFileTypeError'));
      return;
    }

    console.log('file', file);
    const fileOriginalName = file.name;
    let fileResult = '';
    setUploading(true);
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
        let fileContentListNew = [...fileContentList];

        fileContentListNew.unshift({
          fileType: '.docx',
          fileContent: 'This is a word document: \n' + fileResult,
          fileId: fileOriginalName,
        });
        setFileContentList(fileContentListNew);

        setUploading(false);
      };

      reader.onerror = (err) => {
        console.error(err);
        setUploading(false);
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
      console.log('pdf content: ', fileResult);
      let fileContentListNew = [...fileContentList];

      fileContentListNew.unshift({
        fileType: 'pdf',
        fileContent: 'This is a pdf document: \n' + fileResult,
        fileId: fileOriginalName,
      });
      setFileContentList(fileContentListNew);
    }

    if (fileType === 'image') {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const reader = new FileReader();

      let base64String = '';
      reader.onload = () => {
        base64String = reader.result as string;
      };

      reader.onloadend = () => {
        let fileContentListNew = [...fileContentList];

        base64String = reader.result as string;

        fileContentListNew.unshift({
          fileType: 'image',
          fileContent: base64String,
          fileId: fileOriginalName,
        });
        setFileContentList(fileContentListNew);
      };

      reader.readAsDataURL(blob);
    }

    if (fileType === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        fileResult = e.target?.result as string;
      };

      reader.onloadend = () => {
        let fileContentListNew = [...fileContentList];
        fileContentListNew.unshift({
          fileType: 'txt',
          fileContent: 'This is a text document: \n' + fileResult,
          fileId: fileOriginalName,
        });
        setFileContentList(fileContentListNew);
        setUploading(false);
      };

      reader.onerror = (err) => {
        console.error(err);
        setUploading(false);
      };

      reader.readAsText(file);
    }

    let fileListNew = [...fileList];
    const length = fileListNew.length;
    fileListNew.unshift({
      fileName: fileOriginalName,
      fileUrl: '',
      id: length + 1,
      documentId: '',
      fileBlob: file,
    });
    setFileList(fileListNew);
    setUploading(false);
  };

  const handleDeleteFile = (paramItem: FileItem) => {
    const updatedFileList = fileList.filter((item) => item.id !== paramItem.id);
    const updatedFileContentList = fileContentList.filter(
      (item) => item.fileId !== paramItem.fileName
    );
    setFileList(updatedFileList);
    setFileContentList(updatedFileContentList);
  };

  const handleGenerate = () => {
    console.log('in containers.chats.components.chat.handleGenerate');
  };

  const handleInputChange = (
    e: React.FocusEvent<HTMLTextAreaElement, Element>
  ) => {
    setChatContent(e.target.value);
  };

  const handleStreamingResponse = async (
    response: Response,
    updatedChatRecords: ChatRecord[]
  ) => {
    // Add initial empty AI message to prevent UI jump, streaming response will update the message
    setChatRecords([
      ...updatedChatRecords,
      {
        type: UserType.AI,
        message: '',
      },
    ]);

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let aiMessage = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Same as ChatGPT, we do not show success message on the UI after the response is completed
          console.log(
            'Stream completed. Final message length:',
            aiMessage.length
          );
          break;
        }

        aiMessage += value;
        setChatRecords([
          ...updatedChatRecords,
          {
            type: UserType.AI,
            message: aiMessage,
          },
        ]);
      }
    } catch (e) {
      console.error('Error processing stream:', e);
      message.error('Error processing response stream. Please try again.');
    } finally {
      reader.releaseLock();
    }
  };

  const sendMessageToAIWithStreaming = async () => {
    if (chatContent.trim() === '') {
      message.error(t('chat.contentEmpty'));
      return;
    }

    if (isLoading) {
      message.error(t('chat.loadingHistoryError'));
      return;
    }

    if (isGenerationLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'Chat',
          destination: `Chat:${chatSessionId}`,
        },
      });
      return;
    }

    const updatedChatRecords = [
      ...chatRecords,
      {
        type: UserType.HUMAN,
        message: chatContent,
      },
    ];
    setChatRecords(updatedChatRecords);
    setChatContent('');
    setIsThinking(true);

    try {
      const headers = await getHeaders();
      const response = await fetch(
        `${api_url}/api/chats/full-message-streaming`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entityId: chatSessionId,
            entityType: ChatSessionTargetEntityType.CHAT,
            entitySubType: '',
            description: chatContent,
            uploadedFileContent: fileContentList,
            chosenDocumentIds: selectedDocNodes?.length
              ? selectedDocNodes.map((f) => f.key).join(',')
              : '',
            chatSessionId,
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await response.text(); // Get error details from backend
        throw new Error(
          `Request failed with status ${response.status}: ${errorMessage}`
        );
      }

      setIsThinking(false);
      await handleStreamingResponse(response, updatedChatRecords);

      trackEvent('chatMessage', {
        distinct_id: user.email,
        payload: JSON.stringify({
          chatSessionId,
          targetEntityType: ChatSessionTargetEntityType.CHAT,
          docType: '',
          chatContent,
        }),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      message.error('Failed to complete the AI response. Please try again.');
      setIsThinking(false);
    }
  };

  const sampleInputs = AIAgentSampleInputs.CHAT;
  const introMsg = AIAgentIntroMessage.CHAT;
  const breadcrumbItems = [
    {
      key: 'ideas',
      label: 'Ideas',
      link: `/${IdeasPath}`,
    },
    {
      key: chatSession?.name as string,
      label: chatSession?.name as string,
    },
  ];

  const handleConvertToApp = async (
    conversionType?:
      | typeof PROTOTYPE_TYPE_FRONTEND
      | typeof PRODUCT_TYPE_FULLSTACK
  ) => {
    createDocumentMutation.mutate({
      name: chatSession.name,
      type: DOCTYPE.PROTOTYPE,
      access: Access.SELF,
      chatSessionId,
    });
    setIsThinking(true);
    GlobalStoreInst.set('autoGenerateDocForChatSession', chatSessionId);
  };

  return (
    <Flex
      className="chat-container"
      vertical
      style={{ height: '100%', justifyContent: 'space-between' }}
    >
      <DocumentToolbar
        breadcrumbItems={breadcrumbItems}
        handleConvertToApp={handleConvertToApp}
        docActions={[DocumentToolBarActions.Convert]}
      />
      <Flex vertical style={{ flexGrow: 1, justifyContent: 'space-between' }}>
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
                style={{ marginLeft: '4px', margin: 0 }}
              >
                {t('chat.samplePrompt')}
              </Typography.Title>
            </Flex>
            <Flex className="sample-input-container">
              {sampleInputs?.map((item, index) => (
                <Typography.Text
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
      <Flex vertical className="user-input-container" ref={outerDivRef}>
        {fileList && fileList.length > 0 && (
          <Flex
            style={{
              padding: '10px 5px 5px 5px',
              borderRadius: '8px',
              backgroundColor: COLORS.LIGHT_GRAY,
            }}
          >
            {fileList.map((item, index) => {
              return (
                <Tag
                  className="file-tag"
                  closeIcon
                  key={index}
                  onClose={() => handleDeleteFile(item)}
                >
                  <Tooltip title={item.fileName}>
                    <Typography.Text ellipsis className="file-label">
                      {getFileIcon(item.fileName?.split('.')?.pop() || '')}
                      {item.fileName}
                    </Typography.Text>
                  </Tooltip>
                </Tag>
              );
            })}
          </Flex>
        )}
        <Flex
          style={{
            border: 'none',
            marginLeft: 5,
            marginTop: 5,
          }}
          align="center"
        >
          <Upload
            name="file"
            showUploadList={false}
            customRequest={({ file }) => {
              console.log('file: ', file);
              handleChooseMyFile(file as File);
            }}
          >
            <CloudUploadOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            <span
              style={{
                fontSize: 12,
                margin: '0 10px 0 6px',
                cursor: 'pointer',
              }}
            >
              {t('chat.uploadFileAction')}
            </span>
          </Upload>
          <DocTreeNodes
            docs={docs}
            selectedDocNodes={selectedDocNodes}
            setSelectedDocNodes={setSelectedDocNodes}
          />
        </Flex>
        <Input.TextArea
          autoSize={{ minRows: 6, maxRows: 18 }}
          value={chatContent}
          onChange={handleInputChange}
          placeholder={t('chat.inputPlaceholder')}
          className="chat-box-input"
          style={{
            width: '100%',
            fontSize: '13px',
            border: 'none',
            top: '0px',
          }}
        />
        <Flex
          style={{
            position: 'absolute',
            right: 0,
            bottom: 15,
          }}
        >
          <Flex>
            {isGenerationLocked && (
              <Tooltip title={getOutOfCreditTitle(organization, t)}>
                <InfoCircleOutlined
                  style={{ color: 'orange' }}
                  onClick={handleGenerate}
                />
                &nbsp;&nbsp;
              </Tooltip>
            )}
            <Button
              size="small"
              style={{ border: 'none', padding: 0, margin: 1 }}
              onClick={sendMessageToAIWithStreaming}
              className="chat-submit-btn"
            >
              <AiGenerationButton />
            </Button>
          </Flex>
        </Flex>

        {uploading && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Spin size="large" tip={t('chat.uploading')} />
          </div>
        )}
      </Flex>
    </Flex>
  );
}

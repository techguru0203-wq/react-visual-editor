import { useEffect, useRef } from 'react';
import {
  CopyOutlined,
  EditOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Flex } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import ThreeDotsLoader from '../../../common/components/ThreeDotsLoader';
import { useLanguage } from '../../../common/contexts/languageContext';
/** There might be conflicts with svg ids. Use a second one to avoid this issue */
import { ReactComponent as AiAvatar } from '../../../common/icons/ai-avatar-backup.svg';
import { getFileIcon } from '../../../common/util/fileIcon';
import { COLORS } from '../../../lib/constants';

import './ChatRecords.scss';

export enum UserType {
  HUMAN = 'human',
  AI = 'ai',
}

type ChatRecordFile = {
  fileExt: string;
  fileName: string;
};

export type ChatRecord = {
  type: UserType;
  message: string;
  createdAt?: Date;
  files?: ChatRecordFile[];
};

type ChatRecordsProps = Readonly<{
  isLoaded: boolean;
  isThinking: boolean;
  records: ChatRecord[];
  introMsg: string;
  onCopyDoc?: (text: string) => void;
  onEditDoc?: (text: string) => void;
  onGenerateDoc?: (text: string) => void;
}>;

export default function ChatRecords({
  isLoaded,
  isThinking,
  records,
  introMsg,
  onCopyDoc,
  onEditDoc,
  onGenerateDoc,
}: ChatRecordsProps) {
  const { t } = useLanguage();
  const chatContainerBottomDiv = useRef(null);
  const generateDoc = (record: ChatRecord) => {
    onGenerateDoc && onGenerateDoc(record.message);
  };

  const copyText = (record: ChatRecord) => {
    onCopyDoc && onCopyDoc(record.message);
  };

  const editText = (record: ChatRecord) => {
    onEditDoc && onEditDoc(record.message);
  };

  const docIconStyle = {
    marginRight: '3px',
    fontSize: '15px',
  };

  useEffect(() => {
    if (
      chatContainerBottomDiv &&
      chatContainerBottomDiv.current &&
      records.length
    ) {
      (chatContainerBottomDiv.current as HTMLDivElement).scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, [isThinking, records]);

  return (
    <Flex
      style={{
        flexGrow: 1,
        flexDirection: 'column',
        height: '200px',
        overflow: 'auto',
        marginTop: 10,
      }}
    >
      {records.map((record, index) =>
        record.type === UserType.HUMAN ? (
          <Flex
            key={index}
            style={{
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
            }}
          >
            <Flex
              style={{
                borderRadius: '10px',
                padding: '0 10px',
                backgroundColor: '#E3E4FF',
                marginBottom: '15px',
                maxWidth: '80%',
                flexDirection: 'column',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="chat-msg">
                {record.message}
              </ReactMarkdown>{' '}
              {record.files && (
                <Flex
                  style={{
                    marginTop: '5px',
                    marginRight: '-8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {record.files.map((file, index) => (
                    <Flex
                      key={index}
                      style={{
                        alignItems: 'center',
                        marginRight: '8px',
                        marginTop: '5px',
                      }}
                    >
                      {getFileIcon(file.fileExt)}
                      {file.fileName}
                    </Flex>
                  ))}
                </Flex>
              )}
            </Flex>
            <UserOutlined
              style={{
                marginLeft: '6px',
                marginTop: '4px',
                fontSize: '16px',
                color: COLORS.PRIMARY,
                borderRadius: '50%',
                padding: '6px',
                backgroundColor: '#fff',
              }}
            />
          </Flex>
        ) : (
          <Flex
            key={index}
            style={{
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              marginBottom: '15px',
              maxWidth: '80%',
            }}
          >
            <div>
              <AiAvatar style={{ width: '30px', height: '40px' }} />
            </div>
            <Flex
              style={{
                borderRadius: '10px',
                padding: '0 5px',
                backgroundColor: '#fff',
                flexDirection: 'column',
                marginLeft: '5px',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="chat-msg">
                {record.message}
              </ReactMarkdown>
              <Flex
                style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: COLORS.GRAY,
                  display: 'none',
                }}
                className="doc-action-container"
              >
                <CopyOutlined style={docIconStyle} />{' '}
                <div onClick={() => copyText(record)}>{t('document.copy')}</div>
                <EditOutlined style={docIconStyle} />{' '}
                <div onClick={() => editText(record)}>{t('document.edit')}</div>
                <FileTextOutlined style={docIconStyle} />{' '}
                <div onClick={() => generateDoc(record)}>
                  {t('document.generateDoc')}
                </div>
              </Flex>
            </Flex>
          </Flex>
        )
      )}
      {isThinking && (
        <Flex
          style={{
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            marginBottom: '15px',
            maxWidth: '80%',
          }}
        >
          <div>
            <AiAvatar />
          </div>
          <Flex
            style={{
              paddingLeft: '26px',
              paddingTop: '5px',
            }}
          >
            <ThreeDotsLoader />
          </Flex>
        </Flex>
      )}
      {!records?.length && isLoaded && (
        <Flex
          style={{
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            alignItems: 'center',
          }}
        >
          {introMsg}
        </Flex>
      )}
      {!isLoaded && (
        <Flex
          style={{
            height: '100%',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThreeDotsLoader />
        </Flex>
      )}
      <div ref={chatContainerBottomDiv}></div>
    </Flex>
  );
}

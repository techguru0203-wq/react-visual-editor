import { CheckCircleOutlined } from '@ant-design/icons';
import { Flex, Progress } from 'antd';

import LoadingBar from '../../../common/components/LoadingBar';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ProjectFile } from '../../project/components/prototype/PrototypeEditor';

type GeneratingDocLoaderProps = Readonly<{
  loadingPercent?: number;
  docType: string;
  isUpdatingDoc: boolean;
  statusMessage?: string;
  streamingFiles?: ProjectFile[];
}>;

export default function GeneratingDocLoader({
  docType,
  loadingPercent,
  isUpdatingDoc,
  statusMessage,
  streamingFiles = [],
}: GeneratingDocLoaderProps) {
  const { t } = useLanguage();
  return (
    <Flex
      style={{
        position: 'absolute',
        zIndex: 100,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Flex
        style={{
          width: '60%',
          marginTop: '-10%',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Flex style={{ marginBottom: '10px', justifyContent: 'center' }}>
          <LoadingBar />
        </Flex>
        <Progress percent={loadingPercent} status="active" size="small" />
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          {statusMessage ||
            (isUpdatingDoc
              ? t('generation.updatingForYou').replace(
                  '{docType}',
                  docType.toLowerCase()
                )
              : t('generation.creatingForYou').replace(
                  '{docType}',
                  docType.toLowerCase()
                ))}
        </div>

        {/* Show streaming files if available */}
        {streamingFiles.length > 0 && (
          <div style={{ width: '100%', marginTop: '30px' }}>
            {streamingFiles.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#333',
                }}
              >
                {/* Icon - show completed for all files since we're in generating phase */}
                <div style={{ marginTop: '2px' }}>
                  <CheckCircleOutlined
                    style={{ color: 'green', fontSize: 16 }}
                  />
                </div>

                {/* File Purpose */}
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#888' }}>{file.content}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Flex>
    </Flex>
  );
}

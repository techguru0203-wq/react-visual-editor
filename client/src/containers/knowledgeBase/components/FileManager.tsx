import { useEffect, useRef, useState } from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  List,
  message,
  Modal,
  Progress,
  Space,
  Table,
  Tooltip,
  Typography,
  Upload,
} from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import {
  deleteFileApi,
  getFileDownloadUrlApi,
  getKnowledgeBaseFilesApi,
  KBFile,
  presignUploadApi,
  processFileApi,
  reprocessFileApi,
} from '../api/knowledgeBaseApi';

const { Text } = Typography;

interface FileManagerProps {
  knowledgeBaseId: string;
  onUpdate: () => void;
}

interface UploadingFile {
  uid: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

export function FileManager({ knowledgeBaseId, onUpdate }: FileManagerProps) {
  const { t } = useLanguage();
  const pendingUploadsRef = useRef(0);
  const uploadSuccessShownRef = useRef(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth || 0);
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const {
    data: files,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['knowledgeBaseFiles', knowledgeBaseId],
    queryFn: () => getKnowledgeBaseFilesApi(knowledgeBaseId),
    refetchInterval: (data) => {
      // Only auto-refresh if there are files being processed
      const hasProcessingFiles = data?.some(
        (f: KBFile) =>
          f.processingStatus === 'PROCESSING' ||
          f.processingStatus === 'PENDING'
      );
      return hasProcessingFiles ? 5000 : false;
    },
  });

  const onUpload = async (file: File, uid: string) => {
    try {
      console.log('Starting upload for file:', file.name);

      // Add file to uploading list
      setUploadingFiles((prev) => [
        ...prev,
        {
          uid,
          name: file.name,
          size: file.size,
          progress: 0,
          status: 'uploading',
        },
      ]);

      const { uploadUrl, publicUrl, fileId } = await presignUploadApi(
        knowledgeBaseId,
        file.name,
        file.type || 'application/octet-stream',
        file.size
      );
      console.log('Got presigned URL, fileId:', fileId);

      // Update progress to 30% after presigning
      setUploadingFiles((prev) =>
        prev.map((f) => (f.uid === uid ? { ...f, progress: 30 } : f))
      );

      // Upload to S3 with XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            // Map upload progress to 30-80%
            const percentComplete = 30 + Math.round((e.loaded / e.total) * 50);
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.uid === uid ? { ...f, progress: percentComplete } : f
              )
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('S3 upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('S3 upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader(
          'Content-Type',
          file.type || 'application/octet-stream'
        );
        xhr.send(file);
      });

      console.log('File uploaded to S3 successfully');

      // Update progress to 80% and status to processing
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.uid === uid ? { ...f, progress: 80, status: 'processing' } : f
        )
      );

      // Wait a moment for S3 to finalize the upload
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Trigger file processing
      console.log('Triggering file processing for fileId:', fileId);
      await processFileApi(knowledgeBaseId, fileId);
      console.log('File processing triggered successfully');

      // Update to done
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.uid === uid ? { ...f, progress: 100, status: 'done' } : f
        )
      );

      // Remove from list after 2 seconds
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.uid !== uid));
      }, 2000);

      await refetch();
      onUpdate();
      return true;
    } catch (e: any) {
      console.error('Upload error:', e);

      // Update to error status
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.uid === uid
            ? {
                ...f,
                status: 'error',
                errorMessage: e?.message || t('knowledgeBase.uploadError'),
              }
            : f
        )
      );

      // Remove from list after 5 seconds
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.uid !== uid));
      }, 5000);

      message.error(e?.message || t('knowledgeBase.uploadError'));
      return false;
    }
  };

  const handleDownload = async (file: KBFile) => {
    try {
      const downloadUrl = await getFileDownloadUrlApi(knowledgeBaseId, file.id);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      message.error(error.message || t('knowledgeBase.downloadError'));
    }
  };

  const handleDelete = (fileId: string, fileName: string) => {
    Modal.confirm({
      title: t('knowledgeBase.confirmDeleteFile'),
      icon: <ExclamationCircleOutlined />,
      content: `${t('knowledgeBase.confirmDeleteFileMessage')}: ${fileName}`,
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await deleteFileApi(knowledgeBaseId, fileId);
          message.success(t('knowledgeBase.deleteFileSuccess'));
          refetch();
          onUpdate();
        } catch (error: any) {
          message.error(error.message || t('knowledgeBase.deleteFileError'));
        }
      },
    });
  };

  const handleReprocess = async (fileId: string) => {
    try {
      await reprocessFileApi(knowledgeBaseId, fileId);
      message.success(t('knowledgeBase.reprocessStarted'));
      refetch();
    } catch (error: any) {
      message.error(error.message || t('knowledgeBase.reprocessError'));
    }
  };

  const getStatusTag = (
    status: KBFile['processingStatus'],
    errorMessage?: string
  ) => {
    const statusConfig = {
      PENDING: {
        icon: <ClockCircleOutlined />,
        color: 'default',
        text: t('knowledgeBase.statusPending'),
      },
      PROCESSING: {
        icon: <SyncOutlined spin />,
        color: 'processing',
        text: t('knowledgeBase.statusProcessing'),
      },
      COMPLETED: {
        icon: <CheckCircleOutlined />,
        color: 'success',
        text: t('knowledgeBase.statusCompleted'),
      },
      FAILED: {
        icon: <CloseCircleOutlined />,
        color: 'error',
        text: t('knowledgeBase.statusFailed'),
      },
    };

    const config = statusConfig[status];
    const tooltipTitle =
      status === 'FAILED' && errorMessage
        ? `${config.text}: ${errorMessage}`
        : config.text;

    return (
      <Tooltip title={tooltipTitle}>
        <span style={{ fontSize: '18px', color: getStatusColor(config.color) }}>
          {config.icon}
        </span>
      </Tooltip>
    );
  };

  const getStatusColor = (color: string) => {
    const colorMap: Record<string, string> = {
      default: '#d9d9d9',
      processing: '#1890ff',
      success: '#52c41a',
      error: '#ff4d4f',
    };
    return colorMap[color] || '#d9d9d9';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const columns = [
    {
      title: t('knowledgeBase.fileName'),
      dataIndex: 'fileName',
      key: 'fileName',
      width: 160,
      ellipsis: true,
      fixed: 'left' as const,
      render: (fileName: string, record: KBFile) => {
        if (record.processingStatus === 'COMPLETED') {
          return (
            <a
              onClick={(e) => {
                e.preventDefault();
                handleDownload(record);
              }}
              style={{ cursor: 'pointer' }}
            >
              {fileName}
            </a>
          );
        }
        return <span>{fileName}</span>;
      },
    },
    {
      title: t('knowledgeBase.fileSize'),
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 80,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: t('knowledgeBase.status'),
      dataIndex: 'processingStatus',
      key: 'status',
      width: 80,
      align: 'center' as const,
      render: (status: KBFile['processingStatus'], record: KBFile) =>
        getStatusTag(status, record.errorMessage),
    },
    {
      title: t('knowledgeBase.chunks'),
      dataIndex: 'chunkCount',
      key: 'chunks',
      width: 100,
      render: (count: number) => count || '-',
    },
    {
      title: t('knowledgeBase.uploadedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => {
        const d = new Date(date);
        return (
          <div>
            <div>{d.toLocaleDateString()}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {d.toLocaleTimeString()}
            </div>
          </div>
        );
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: KBFile) => (
        <Space size="small">
          <Tooltip title={t('knowledgeBase.download')}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          {record.processingStatus === 'FAILED' && (
            <Tooltip title={t('knowledgeBase.reprocess')}>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleReprocess(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.delete')}>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id, record.fileName)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Upload.Dragger
          multiple
          showUploadList={false}
          customRequest={async (options) => {
            pendingUploadsRef.current += 1;
            if (pendingUploadsRef.current === 1) {
              uploadSuccessShownRef.current = false;
            }
            const f = options.file as File;
            const uid = `${Date.now()}_${Math.random()}`;
            const ok = await onUpload(f, uid);
            if (ok) {
              if (!uploadSuccessShownRef.current) {
                message.success(t('knowledgeBase.uploadSuccess'));
                uploadSuccessShownRef.current = true;
              }
              options.onSuccess?.({}, new XMLHttpRequest());
            } else {
              options.onError?.(new Error('upload failed'));
            }
            pendingUploadsRef.current = Math.max(
              0,
              pendingUploadsRef.current - 1
            );
          }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">{t('knowledgeBase.dragUpload')}</p>
          <p className="ant-upload-hint">
            {t('knowledgeBase.supportedFormats')}
          </p>
        </Upload.Dragger>
      </div>

      {/* Uploading files progress */}
      {uploadingFiles.length > 0 && (
        <div
          style={{
            marginBottom: '12px',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <List
            dataSource={uploadingFiles}
            renderItem={(file) => (
              <List.Item
                style={{
                  padding: '6px 0',
                  borderBottom:
                    uploadingFiles.indexOf(file) < uploadingFiles.length - 1
                      ? '1px solid #d9d9d9'
                      : 'none',
                }}
              >
                <div style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <Text strong style={{ flex: 1, marginRight: '8px' }}>
                      {file.name}
                    </Text>
                    <Text type="secondary">{formatFileSize(file.size)}</Text>
                  </div>
                  {file.status === 'uploading' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Progress
                        percent={file.progress}
                        size="small"
                        status="active"
                        style={{ flex: 1, margin: 0 }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('knowledgeBase.uploading')}
                      </Text>
                    </div>
                  )}
                  {file.status === 'processing' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Progress
                        percent={file.progress}
                        size="small"
                        status="active"
                        style={{ flex: 1, margin: 0 }}
                      />
                      <Space>
                        <LoadingOutlined />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {t('knowledgeBase.processing')}
                        </Text>
                      </Space>
                    </div>
                  )}
                  {file.status === 'done' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Progress
                        percent={100}
                        size="small"
                        status="success"
                        style={{ flex: 1, margin: 0 }}
                      />
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <Text type="success" style={{ fontSize: '12px' }}>
                          {t('knowledgeBase.uploadComplete')}
                        </Text>
                      </Space>
                    </div>
                  )}
                  {file.status === 'error' && (
                    <div>
                      <Progress
                        percent={file.progress}
                        size="small"
                        status="exception"
                        style={{ margin: 0 }}
                      />
                      <Text type="danger" style={{ fontSize: '12px' }}>
                        {file.errorMessage}
                      </Text>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      <div ref={tableContainerRef} style={{ width: '100%' }}>
        <Table
          dataSource={files || []}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: Math.max(600, containerWidth) }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${t('knowledgeBase.files')}${total} `,
          }}
        />
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Grid,
  message,
  Popconfirm,
  Progress,
  Radio,
  Space,
  Spin,
  Table,
  Tooltip,
  Upload,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  FileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../../../common/contexts/languageContext';
import {
  deleteFile,
  getQuota,
  listFiles,
  presignUpload,
  ListedItem,
} from '../../api/filesApi';

type Props = {
  documentId?: string;
  isReadOnly?: boolean;
};

const { useBreakpoint } = Grid;

const humanSize = (size: number) => {
  if (size >= 1024 * 1024 * 1024)
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
  if (size >= 1024) return (size / 1024).toFixed(2) + ' KB';
  return size + ' B';
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
};

const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const isImage = (name: string) => {
  const idx = name.lastIndexOf('.');
  const ext = idx >= 0 ? name.substring(idx).toLowerCase() : '';
  return imageExt.has(ext);
};

const FilesTab: React.FC<Props> = ({ documentId, isReadOnly }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'list' | 'grid'>('grid');
  const [items, setItems] = useState<ListedItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<{
    usedBytes: number;
    limitBytes: number;
  } | null>(null);
  const pendingUploadsRef = React.useRef(0);
  const uploadSuccessShownRef = React.useRef(false);

  const reloadQuota = useCallback(async () => {
    if (!documentId) return;
    try {
      const q = await getQuota(documentId);
      setQuota(q);
    } catch (e) {
      message.error(t('files.loadQuotaFailed'));
    }
  }, [documentId, t]);

  const load = useCallback(
    async (reset = false) => {
      if (!documentId) return;
      setLoading(true);
      try {
        const res = await listFiles(documentId, reset ? undefined : cursor);
        setItems(reset ? res.items : [...items, ...res.items]);
        setCursor(res.nextCursor);
        setQuota((q) =>
          q
            ? { ...q, usedBytes: res.usedBytes }
            : { usedBytes: res.usedBytes, limitBytes: 1024 * 1024 * 1024 }
        );
      } catch (e) {
        message.error(t('files.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [documentId, cursor, items, t]
  );

  useEffect(() => {
    load(true);
    reloadQuota();
  }, [documentId]);

  const onUpload = async (file: File) => {
    if (!documentId) return false;
    try {
      const { uploadUrl, publicUrl } = await presignUpload({
        documentId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
      // Use fetch for simplicity
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('upload failed');
      await load(true);
      return true;
    } catch (e: any) {
      message.error(
        e?.message?.includes('quota')
          ? t('files.overQuota')
          : t('files.uploadFailed')
      );
      return false;
    }
  };

  const onDelete = async (record: ListedItem) => {
    if (!documentId) return;
    try {
      await deleteFile(documentId, record.key);
      await load(true);
    } catch (e) {
      message.error(t('files.deleteFailed'));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('files.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_: any, record: ListedItem) => (
          <a href={record.url} target="_blank" rel="noreferrer">
            {record.name}
          </a>
        ),
      },
      {
        title: t('files.size'),
        dataIndex: 'size',
        key: 'size',
        render: (v: number) => humanSize(v),
      },
      {
        title: t('files.updatedAt'),
        dataIndex: 'lastModified',
        key: 'lastModified',
        width: 200,
        render: (v?: string) => formatDateTime(v),
      },
      {
        title: t('files.actions'),
        key: 'actions',
        width: 160,
        render: (_: any, record: ListedItem) => (
          <Space>
            <Tooltip title={t('files.copyLink')}>
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(record.url);
                  message.success(t('files.linkCopied'));
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t('files.deleteConfirm')}
              onConfirm={() => onDelete(record)}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
              disabled={isReadOnly}
            >
              <Button danger icon={<DeleteOutlined />} disabled={isReadOnly} />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [t, isReadOnly]
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          {quota && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {t('files.quota')}: {humanSize(quota.usedBytes)} /{' '}
                {humanSize(quota.limitBytes)}
              </span>
              <Progress
                percent={Number(
                  Math.min(
                    100,
                    (quota.usedBytes / Math.max(1, quota.limitBytes)) * 100
                  ).toFixed(1)
                )}
                format={(p) => `${(p ?? 0).toFixed(1)}%`}
                style={{ width: 120, marginBottom: 0 }}
              />
            </div>
          )}
        </div>
        <Radio.Group value={view} onChange={(e) => setView(e.target.value)}>
          <Radio.Button value="grid">{t('files.gridView')}</Radio.Button>
          <Radio.Button value="list">{t('files.listView')}</Radio.Button>
        </Radio.Group>
        <Button icon={<ReloadOutlined />} onClick={() => load(true)} />
      </div>

      {!isReadOnly && (
        <div style={{ marginBottom: 16 }}>
          <Upload.Dragger
            multiple
            showUploadList={false}
            customRequest={async (options) => {
              pendingUploadsRef.current += 1;
              if (pendingUploadsRef.current === 1) {
                uploadSuccessShownRef.current = false;
              }
              const f = options.file as File;
              const ok = await onUpload(f);
              if (ok) {
                if (!uploadSuccessShownRef.current) {
                  message.success(t('files.uploadSuccess'));
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
            <p>{t('files.upload')}</p>
          </Upload.Dragger>
        </div>
      )}

      {view === 'list' ? (
        <Table
          rowKey={(r) => r.key}
          dataSource={items}
          columns={columns}
          pagination={false}
          loading={loading}
          locale={{ emptyText: <Empty description={t('files.empty')} /> }}
        />
      ) : (
        <Spin spinning={loading}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            {items.length === 0 && !loading ? (
              <Empty description={t('files.empty')} />
            ) : (
              items.map((it) => (
                <div
                  key={it.key}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block' }}
                  >
                    <div
                      style={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#fafafa',
                        cursor: 'pointer',
                      }}
                    >
                      {isImage(it.name) ? (
                        <img
                          src={it.url}
                          alt={it.name}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      ) : (
                        <FileOutlined style={{ fontSize: 40, color: '#999' }} />
                      )}
                    </div>
                  </a>
                  <div style={{ marginTop: 8, fontSize: 12 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {humanSize(it.size)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Tooltip title={t('files.copyLink')}>
                      <Button
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(it.url);
                          message.success(t('files.linkCopied'));
                        }}
                        icon={<CopyOutlined />}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('files.deleteConfirm')}
                      onConfirm={() => onDelete(it)}
                      okText={t('common.ok')}
                      cancelText={t('common.cancel')}
                      disabled={isReadOnly}
                    >
                      <Button
                        size="small"
                        danger
                        disabled={isReadOnly}
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </div>
                </div>
              ))
            )}
          </div>
        </Spin>
      )}

      {cursor && (
        <div
          style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}
        >
          <Button onClick={() => load(false)} loading={loading}>
            {t('common.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FilesTab;

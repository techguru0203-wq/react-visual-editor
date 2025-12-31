import React, { useState, useEffect } from 'react';
import { Button, Typography, Space, Input, message, Tooltip } from 'antd';
import {
  GlobalOutlined,
  UnorderedListOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../../common/contexts/languageContext';
import { COLORS } from '../../../lib/constants';

const { Text } = Typography;

interface PublishPanelProps {
  documentId: string;
  documentName?: string;
  publishUrl?: string;
  publishedAt?: Date | string;
  previewUpdatedAt?: Date | string;
  onPublishToWeb: () => Promise<void>;
  onCreateDevPlan: () => void;
  isPublishing: boolean;
  onOpenDomainSettings?: () => void;
}

export const PublishPanel: React.FC<PublishPanelProps> = ({
  documentId,
  documentName,
  publishUrl,
  publishedAt,
  previewUpdatedAt,
  onPublishToWeb,
  onCreateDevPlan,
  isPublishing,
  onOpenDomainSettings,
}) => {
  const { t } = useLanguage();
  const [currentPublishUrl, setCurrentPublishUrl] = useState(publishUrl);

  useEffect(() => {
    setCurrentPublishUrl(publishUrl);
  }, [publishUrl]);

  const handleCopyUrl = () => {
    if (currentPublishUrl) {
      navigator.clipboard.writeText(currentPublishUrl);
      message.success(t('publish.urlCopied'));
    }
  };

  const handleVisitSite = () => {
    if (currentPublishUrl) {
      window.open(currentPublishUrl, '_blank');
    }
  };

  const formatPublishTime = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const isPublished = !!currentPublishUrl;
  const hasNewerPreview = (() => {
    if (!publishedAt || !previewUpdatedAt) return false;
    const pAt = new Date(publishedAt as any).getTime();
    const prevAt = new Date(previewUpdatedAt as any).getTime();
    if (Number.isNaN(pAt) || Number.isNaN(prevAt)) return false;
    return prevAt > pAt;
  })();

  if (!isPublished) {
    return (
      <div
        style={{
          width: '400px',
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Text
          strong
          style={{ fontSize: '16px', display: 'block', marginBottom: '16px' }}
        >
          {t('publish.title')}
        </Text>

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<GlobalOutlined />}
            onClick={onPublishToWeb}
            loading={isPublishing}
            style={{
              backgroundColor: COLORS.PRIMARY,
              height: '44px',
            }}
          >
            {isPublishing ? t('publish.publishing') : t('publish.publishToWeb')}
          </Button>

          <Button
            size="large"
            block
            icon={<UnorderedListOutlined />}
            onClick={onCreateDevPlan}
            style={{ height: '44px' }}
          >
            {t('publish.createDevPlan')}
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          width: '480px',
          padding: '24px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Text
          strong
          style={{ fontSize: '18px', display: 'block', marginBottom: '16px' }}
        >
          {t('publish.publishYourProject')}
        </Text>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <GlobalOutlined style={{ fontSize: '16px', color: COLORS.PRIMARY }} />
          <Text strong style={{ flex: 1 }}>
            {documentName || 'Project'}
          </Text>
          <Button
            type="primary"
            onClick={onPublishToWeb}
            loading={isPublishing}
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            {t('publish.republish')}
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <ClockCircleOutlined style={{ fontSize: '12px', color: '#999' }} />
          <Tooltip placement="top" title={t('publish.lastPublishedAt')}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {publishedAt
                ? formatPublishTime(publishedAt)
                : t('publish.publishedRecently')}
            </Text>
          </Tooltip>
          {hasNewerPreview && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 6,
                background: '#f6ffed', // info bg color (light green)
                border: '1px solid #b7eb8f', // info border (light green)
                color: '#389e0d', // info text/icon (green)
                fontSize: 12,
                lineHeight: 1,
                marginLeft: 'auto',
              }}
            >
              <InfoCircleOutlined />
              {t('publish.previewNewerNotice')}
            </span>
          )}
        </div>

        {/* Inline notice moved next to time row */}

        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <Input
            value={currentPublishUrl}
            readOnly
            prefix={<GlobalOutlined style={{ color: COLORS.PRIMARY }} />}
            style={{ flex: 1 }}
            size="middle"
          />
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyUrl}
            title={t('publish.copyUrl')}
          />
          <Button onClick={handleVisitSite}>{t('publish.visitSite')}</Button>
        </div>

        <Button
          block
          size="large"
          onClick={() => onOpenDomainSettings?.()}
          icon={<LinkOutlined />}
          style={{
            height: '44px',
            marginBottom: '8px',
          }}
        >
          {t('publish.customDomain')}
        </Button>

        <Button
          size="large"
          block
          icon={<UnorderedListOutlined />}
          onClick={onCreateDevPlan}
          style={{ height: '44px' }}
        >
          {t('publish.createDevPlan')}
        </Button>
      </div>
    </>
  );
};

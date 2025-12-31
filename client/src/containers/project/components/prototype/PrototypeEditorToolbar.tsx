import {
  ArrowUpOutlined,
  CodeOutlined,
  DesktopOutlined,
  EyeOutlined,
  MobileOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { SubscriptionTier } from '@prisma/client';
import { Button, Flex, Tooltip } from 'antd';
import { GitCompare, ScrollText } from 'lucide-react';

import { ProjectAccessResponse } from '../../../../../../shared/types';
import { useAppModal } from '../../../../common/components/AppModal';
import { viewOnlyMessage } from '../../../../common/constants';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { COLORS } from '../../../../lib/constants';
import trackEvent from '../../../../trackingClient';
import useUserProfileQuery from '../../../profile/hooks/useUserProfileQuery';

interface PrototypeEditorToolbarProps {
  viewMode: 'code' | 'preview';
  previewMode: 'desktop' | 'mobile';
  isReadOnly: boolean;
  hasUnsavedChanges: boolean;
  isEditing: boolean;
  access?: ProjectAccessResponse;
  docId: string;
  deployUrl?: string;
  previewDeploymentId?: string;
  productionDeploymentId?: string;
  productionUrl?: string;
  previewUrl?: string;
  onViewModeChange: (mode: 'code' | 'preview') => void;
  onPreviewModeChange: (mode: 'desktop' | 'mobile') => void;
  onSave: () => void;
  onViewDiff?: () => void;
  onViewLogs: () => void;
  onShare?: () => void; // Share handler
  hasFiles?: boolean; // Whether files are available (defaults to true for backward compatibility)
}

export function PrototypeEditorToolbar({
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
  onViewModeChange,
  onPreviewModeChange,
  onSave,
  onViewDiff,
  onViewLogs,
  onShare,
  hasFiles = true,
}: PrototypeEditorToolbarProps) {
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();
  const { user } = useCurrentUser();
  const { data: userProfile } = useUserProfileQuery(user.id);

  const isFreeUser = userProfile?.subscriptionTier === SubscriptionTier.FREE;
  const canViewLogs =
    userProfile?.subscriptionTier === SubscriptionTier.PRO ||
    userProfile?.subscriptionTier === SubscriptionTier.BUSINESS ||
    userProfile?.subscriptionTier === SubscriptionTier.ENTERPRISE;

  const isPreviewView = () => viewMode === 'preview';
  const isCodeView = () => viewMode === 'code';

  return (
    <Flex align="center" gap={48} style={{ justifyContent: 'center' }}>
      {/* Group 1: Preview/Code toggle, Desktop/Mobile, Code diff */}
      <Flex align="center">
        {/* Preview/Code sliding toggle button */}
        <Flex
          style={{
            backgroundColor: '#f5f5f5',
            borderRadius: '20px',
            padding: '4px',
            display: 'inline-flex',
          }}
        >
          <Tooltip
            title={!isPreviewView() ? t('common.previewApp') || 'Preview' : ''}
          >
            <Button
              type="text"
              onClick={() => hasFiles && onViewModeChange('preview')}
              disabled={!hasFiles}
              style={{
                borderRadius: '16px',
                padding: isPreviewView() ? '4px 12px' : '4px 8px',
                height: '32px',
                border: 'none',
                backgroundColor: isPreviewView() ? '#F0EDFF' : 'transparent',
                color: !hasFiles
                  ? '#ccc'
                  : isPreviewView()
                    ? '#5345F3'
                    : '#666',
                fontWeight: isPreviewView() ? 500 : 400,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <EyeOutlined />
              {isPreviewView() && <span>Preview</span>}
            </Button>
          </Tooltip>
          <Tooltip
            title={
              !isCodeView()
                ? isFreeUser
                  ? t('common.upgradePlanToViewCode')
                  : t('common.viewCode') || 'Code'
                : ''
            }
          >
            <Button
              type="text"
              onClick={() => {
                if (!hasFiles) return;
                if (isFreeUser) {
                  showAppModal({
                    type: 'updateSubscription',
                    payload: {
                      email: user.email,
                      source: 'viewCodeLimit',
                      destination: 'newPlan',
                      isLowCredits: false,
                    },
                  });
                  return;
                }
                onViewModeChange('code');
              }}
              disabled={!hasFiles || isFreeUser}
              style={{
                borderRadius: '16px',
                padding: isCodeView() ? '4px 12px' : '4px 8px',
                height: '32px',
                border: 'none',
                backgroundColor: isCodeView() ? '#F0EDFF' : 'transparent',
                color:
                  !hasFiles || isFreeUser
                    ? '#ccc'
                    : isCodeView()
                      ? '#5345F3'
                      : '#666',
                fontWeight: isCodeView() ? 500 : 400,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CodeOutlined />
              {isCodeView() && <span>Code</span>}
            </Button>
          </Tooltip>
        </Flex>

        {/* Context button based on mode */}
        {isPreviewView() ? (
          <Tooltip
            title={
              previewMode === 'desktop'
                ? t('prototypeEditor.mobilePreviewMode')
                : t('prototypeEditor.desktopPreviewMode')
            }
          >
            <Button
              type="text"
              onClick={() =>
                hasFiles &&
                onPreviewModeChange(
                  previewMode === 'desktop' ? 'mobile' : 'desktop'
                )
              }
              disabled={!hasFiles}
              style={{
                color: !hasFiles ? '#ccc' : '#5345F3',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {previewMode === 'desktop' ? (
                <MobileOutlined />
              ) : (
                <DesktopOutlined />
              )}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title={t('codeDiff.viewChanges')}>
            <Button
              type="text"
              onClick={() => {
                if (!hasFiles || !onViewDiff) return;
                trackEvent('view_diff_clicked', {
                  distinct_id: user.email,
                  documentId: docId,
                });
                onViewDiff();
              }}
              disabled={!hasFiles || !onViewDiff}
              style={{
                color: !hasFiles || !onViewDiff ? '#ccc' : '#5345F3',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitCompare size={16} />
            </Button>
          </Tooltip>
        )}
      </Flex>
      {/* Group 2: Share, View Logs, View app */}
      <Flex align="center">
        {onShare && (
          <Tooltip
            title={isReadOnly ? viewOnlyMessage : t('toolbar.shareProject')}
          >
            <Button
              type="text"
              onClick={onShare}
              disabled={!hasFiles || isReadOnly}
              style={{
                borderRadius: '16px',
                padding: '4px 12px',
                height: '32px',
                border: 'none',
                backgroundColor:
                  !hasFiles || isReadOnly ? 'transparent' : '#F0EDFF',
                color: !hasFiles || isReadOnly ? '#ccc' : '#5345F3',
                fontWeight: 500,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShareAltOutlined />
              <span>{t('toolbar.share')}</span>
            </Button>
          </Tooltip>
        )}
        <Tooltip
          title={
            canViewLogs
              ? 'View Logs'
              : t('prototypeEditor.upgradePlanToViewLogs')
          }
        >
          <Button
            type="default"
            onClick={() => {
              if (
                !hasFiles ||
                (!previewDeploymentId &&
                  !productionDeploymentId &&
                  !productionUrl &&
                  !previewUrl)
              ) {
                return;
              }
              trackEvent('view_logs_clicked', {
                distinct_id: user.email,
                documentId: docId,
                hasAccess: canViewLogs,
              });
              if (canViewLogs) {
                onViewLogs();
              } else {
                showAppModal({
                  type: 'updateSubscription',
                  payload: {
                    email: user.email,
                    source: 'prototypeEditor',
                    destination: 'viewLogs',
                  },
                });
              }
            }}
            disabled={
              !hasFiles ||
              (!previewDeploymentId &&
                !productionDeploymentId &&
                !productionUrl &&
                !previewUrl)
            }
            style={{
              color:
                !hasFiles ||
                (!previewDeploymentId &&
                  !productionDeploymentId &&
                  !productionUrl &&
                  !previewUrl) ||
                !canViewLogs
                  ? '#ccc'
                  : '#5345F3',
              backgroundColor: '#fff',
              border: 'none',
              padding: '0px 5px',
              fontSize: 18,
            }}
          >
            <ScrollText size={16} />
          </Button>
        </Tooltip>
        {/* View app fullscreen button */}
        <Tooltip
          title={isReadOnly ? viewOnlyMessage : t('prototypeEditor.viewApp')}
        >
          <Button
            type="text"
            onClick={() =>
              hasFiles && deployUrl && window.open(deployUrl, '_blank')
            }
            disabled={!hasFiles || !deployUrl}
            style={{
              color: !hasFiles || !deployUrl ? '#ccc' : '#5345F3',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(45deg)',
            }}
          >
            <ArrowUpOutlined
              style={{
                color: !hasFiles || !deployUrl ? '#ccc' : COLORS.PRIMARY,
                fontSize: 16,
              }}
            />
          </Button>
        </Tooltip>
      </Flex>
    </Flex>
  );
}

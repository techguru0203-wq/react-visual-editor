// add a react component that renders a button that allows the user to download the document

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClockCircleOutlined,
  CloudUploadOutlined,
  EllipsisOutlined,
  ExportOutlined,
  FileOutlined,
  FilePdfOutlined,
  GithubOutlined,
  GlobalOutlined,
  SaveOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { DOCTYPE, Prisma } from '@prisma/client';
import {
  Badge,
  Button,
  Dropdown,
  Flex,
  MenuProps,
  message,
  Popover,
  Tooltip,
} from 'antd';
import { AlignmentType, Document, Packer, Paragraph, Table } from 'docx';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import AppBreadcrumb, {
  BreadCrumbItem,
} from '../../../common/components/AppBreadcrumb';
import { useAppModal } from '../../../common/components/AppModal';
import ProjectStep from '../../../common/components/ProjectStep';
import {
  PRODUCT_TYPE_FULLSTACK,
  PROTOTYPE_TYPE_FRONTEND,
  translateStatusMessage,
  viewOnlyMessage,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useProjectQuery } from '../../../common/hooks/useProjectsQuery';
import { useMakeProductStore } from '../../../common/store/makeProductStore';
import { isFeatureLocked } from '../../../common/util/app';
import { generateDeployDocId } from '../../../common/util/vercelUtils';
import {
  COLORS,
  DEFAULT_DOCUMENT_ACCESS,
  SUBSCRIPTIONTIERS,
} from '../../../lib/constants';
import { convertDocxToPdf } from '../../../lib/convert';
import { BitbucketUserProfile } from '../../../shared/types/bitbucketTypes';
import { GithubUserProfile } from '../../../shared/types/githubTypes';
import trackEvent from '../../../trackingClient';
import { DevPlanOutput } from '../../devPlans/types/devPlanTypes';
import { DevPlansPath, DocumentsPath } from '../../nav/paths';
import { getUserBitbucketProfile } from '../../project/api/bitbucketApi';
import { publishToProduction } from '../../project/api/deployApi';
import { getUserGithubProfile } from '../../project/api/githubApi';
import BitbucketShow from '../../project/components/prototype/BitbucketShow';
import GitHubShow from '../../project/components/prototype/GitHubShow';
import { DocumentWithoutContent } from '../../project/components/prototype/PrototypeEditorShow';
import { useTeamOrOrganizationUsers } from '../../team/hooks/useTeamOrOrganizationUsers';
import { DocumentOutput } from '../types/documentTypes';
import DocumentSettingsModal from './DocumentSettingsModal/DocumentSettingsModal';
import MakeProductModal, { Teammate } from './MakeProductModal';
import { PublishPanel } from './PublishPanel';

import './DocumentToolbar.scss';

interface DocumentToolbarProps {
  breadcrumbItems: ReadonlyArray<BreadCrumbItem>;
  doc?: DocumentOutput | DevPlanOutput;
  updateDoc?: (
    e: React.MouseEvent<HTMLButtonElement>,
    isRefresh: boolean,
    isPublish: boolean
  ) => void;
  docActions?: string[];
  paragraphs?: (Paragraph | Table)[];
  pdfLineHeight?: number;
  onDeploy?: () => void;
  isReadOnly?: boolean;
  toolbarDisabled?: boolean;
  handleConvertToApp?: (
    conversionType?:
      | typeof PROTOTYPE_TYPE_FRONTEND
      | typeof PRODUCT_TYPE_FULLSTACK
  ) => void;
  hideProgressBar?: boolean;
  isStreaming?: boolean;
  isGeneratingDoc?: boolean;
  onOpenSettingsModal?: (fn: (initialTab?: string) => void) => void; // Function to receive the modal opener function
  onToggleChatCollapse?: () => void; // Callback to toggle chat collapse
  onToggleHistory?: () => void; // Callback to toggle history drawer
  onToggleSidepanel?: () => void; // Callback to toggle sidepanel visibility
  isSidepanelVisible?: boolean; // Current sidepanel visibility state
  centerActions?: React.ReactNode; // Center actions to display above main content
  saveButtonState?: {
    onSave: () => void;
    hasUnsavedChanges: boolean;
    isEditing: boolean;
    hasFiles: boolean;
    isReadOnly: boolean;
  }; // Save button state for prototype/product pages
}

export const DocumentToolBarActions = {
  Publish: 'toolbar.publish',
  Export: 'toolbar.export',
  Share: 'toolbar.share',
  Convert: 'toolbar.convert',
  ViewDatabase: 'toolbar.viewDatabase',
  Codebase: 'toolbar.codebase',
  GitHub: 'toolbar.github',
  Bitbucket: 'toolbar.bitbucket',
};

export default function DocumentToolbar({
  breadcrumbItems,
  doc,
  updateDoc,
  paragraphs,
  docActions = [
    DocumentToolBarActions.Convert,
    DocumentToolBarActions.Publish,
    DocumentToolBarActions.ViewDatabase,
    DocumentToolBarActions.Codebase,
    DocumentToolBarActions.Export,
    DocumentToolBarActions.Share,
  ],
  pdfLineHeight,
  onDeploy,
  handleConvertToApp,
  isReadOnly = false,
  toolbarDisabled = false,
  hideProgressBar = false,
  isStreaming = false,
  isGeneratingDoc = false,
  onOpenSettingsModal,
  onToggleChatCollapse,
  onToggleHistory,
  onToggleSidepanel,
  isSidepanelVisible,
  centerActions,
  saveButtonState,
}: DocumentToolbarProps) {
  const { showAppModal } = useAppModal();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const navigate = useNavigate();
  const setMakeProductData = useMakeProductStore(
    (state) => state.setMakeProductData
  );
  const { data: project } = useProjectQuery(doc?.projectId as string);

  const [githubUserProfile, setGithubUserProfile] =
    useState<GithubUserProfile | null>(null);
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const location = useLocation();

  const [githubRepoUrl, setGithubRepoUrl] = useState<string>('');

  const [makeProductModalOpen, setMakeProductModalOpen] = useState(false);
  const [makeProductLoading, setMakeProductLoading] = useState(false);

  const [bitbucketUserProfile, setBitbucketUserProfile] =
    useState<BitbucketUserProfile | null>(null);
  const [isBitbucketConnected, setIsBitbucketConnected] = useState(false);
  const [bitbucketRepoUrl, setBitbucketRepoUrl] = useState<string>('');

  const [codebasePopoverOpen, setCodebasePopoverOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Check if current document is a workflow step page without content
  // Buttons should be disabled only when there's no content on workflow step pages
  const isWorkflowStepPageWithoutContent = useMemo(() => {
    if (!doc?.type) return false;
    const workflowStepTypes: DOCTYPE[] = [
      DOCTYPE.PRD,
      DOCTYPE.TECH_DESIGN,
      DOCTYPE.PROTOTYPE,
      DOCTYPE.PRODUCT,
      DOCTYPE.DEVELOPMENT_PLAN,
      DOCTYPE.QA_PLAN,
      DOCTYPE.RELEASE_PLAN,
      DOCTYPE.UI_DESIGN,
    ];
    const isWorkflowStep = workflowStepTypes.includes(doc.type as DOCTYPE);
    // Only disable if it's a workflow step page AND has no content
    return isWorkflowStep && !doc?.contents;
  }, [doc?.type, doc?.contents]);

  // Function to force UI refresh
  const forceRefresh = useCallback(() => {
    setRefreshTrigger((prev) => {
      const newValue = prev + 1;
      return newValue;
    });

    // Also refresh the document data to get the latest state from the database
    if (updateDoc) {
      updateDoc({} as React.MouseEvent<HTMLButtonElement>, true, false);
    }

    // Force another refresh after a delay to ensure the document state is updated
    setTimeout(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 500);
  }, [updateDoc]);

  // Callback to handle document updates from settings modal
  const handleDocumentUpdated = useCallback(
    (updatedDoc: any) => {
      // Force refresh to pick up the latest document state
      forceRefresh();
    },
    [forceRefresh]
  );
  const [settingsModalInitialTab, setSettingsModalInitialTab] = useState<
    string | undefined
  >();
  const [publishPopoverOpen, setPublishPopoverOpen] = useState(false);

  // Store the function to open settings modal with specific tab
  const openSettingsModalWithTab = useCallback((initialTab?: string) => {
    setSettingsModalInitialTab(initialTab);
    setSettingsModalVisible(true);
  }, []);

  // Expose function to parent component
  useEffect(() => {
    if (onOpenSettingsModal) {
      onOpenSettingsModal(openSettingsModalWithTab);
    }
  }, [onOpenSettingsModal, openSettingsModalWithTab]);

  // Fetch teammates (organization-wide for now)
  const { data: teammatesData, isLoading: teammatesLoading } =
    useTeamOrOrganizationUsers({ source: 'organization' });
  const teammates: Teammate[] = (teammatesData || []).map((u: any) => ({
    id: u.id,
    name: u.name || u.email,
    specialty: u.specialty,
    velocity: u.velocity,
  }));

  const isCustomDomainLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string,
    SUBSCRIPTIONTIERS.STARTER
  );

  useEffect(() => {
    let meta = doc?.meta as Prisma.JsonObject;
    const repoUrl = meta?.repoUrl as string;

    if (repoUrl) {
      if (repoUrl.includes('bitbucket')) {
        setBitbucketRepoUrl(repoUrl);
        setGithubRepoUrl(''); // Clear GitHub URL
      } else if (repoUrl.includes('github')) {
        setGithubRepoUrl(repoUrl);
        setBitbucketRepoUrl(''); // Clear Bitbucket URL
      } else {
        setGithubRepoUrl(repoUrl);
        setBitbucketRepoUrl(repoUrl);
      }
    } else {
      setGithubRepoUrl('');
      setBitbucketRepoUrl('');
    }
  }, [doc?.meta, setGithubRepoUrl, setBitbucketRepoUrl]);

  function handleShareDoc(e: React.MouseEvent<HTMLButtonElement>) {
    const baseUrl = window.location.origin;
    // track event
    trackEvent('shareDocument', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: doc?.id,
        documentType: doc?.type,
        source: 'documentToolbar',
      }),
    });
    let shareLink;
    if (doc?.type === DOCTYPE.DEVELOPMENT_PLAN) {
      shareLink = `${baseUrl}/${DevPlansPath}/${doc?.id}`;
    } else {
      shareLink = `${baseUrl}/${DocumentsPath}/${doc?.id}`;
    }
    if (doc) {
      showAppModal({
        type: 'docSharing',
        docId: doc.id,
        title: `Share "${doc.name}"`,
        documentAccess: doc.access || DEFAULT_DOCUMENT_ACCESS,
      });
    }
  }

  async function handleExportPdfV1() {
    const currDate = new Date().toLocaleDateString();
    const filename = doc?.name + '_' + currDate + '.pdf';
    const exportDoc = new Document({
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 260 },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {},
          children: paragraphs as Paragraph[],
        },
      ],
    });
    const docxBlob: Blob = await Packer.toBlob(exportDoc);
    const pdfBase64 = await convertDocxToPdf(docxBlob, pdfLineHeight);
    const link = document.createElement('a');
    link.href = pdfBase64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // track event
    trackEvent('exportDocumentV1', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: doc?.id,
        name: filename,
        documentType: doc?.type,
      }),
    });
  }

  async function handleExportDocxV1() {
    const currDate = new Date().toLocaleDateString();
    const filename = doc?.name + '_' + currDate + '.docx';
    const exportDoc = new Document({
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 260 },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {},
          children: paragraphs as Paragraph[],
        },
      ],
    });

    const blob = await Packer.toBlob(exportDoc);

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    // track event
    trackEvent('exportDocx', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: doc?.id,
        name: filename,
        documentType: doc?.type,
      }),
    });
  }

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 575);
      setIsTablet(width > 575 && width <= 1200);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    const fetchGithubProfile = async () => {
      if (!githubUserProfile) {
        const profile = await getUserGithubProfile();
        if (profile) {
          setGithubUserProfile(profile);
          setIsGithubConnected(true);
        }
      }
    };
    fetchGithubProfile();
  }, [githubUserProfile]);

  useEffect(() => {
    const fetchBitbucketProfile = async () => {
      if (!bitbucketUserProfile) {
        const profile = await getUserBitbucketProfile();
        if (profile) {
          setBitbucketUserProfile(profile);
          setIsBitbucketConnected(true);
        }
      }
    };
    fetchBitbucketProfile();
  }, [bitbucketUserProfile]);

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'export-pdf',
      label: t('toolbar.exportPdf'),
      onClick: handleExportPdfV1,
    },
    {
      key: 'export-docx',
      label: t('toolbar.exportDocx'),
      onClick: handleExportDocxV1,
    },
  ];

  const getCodebaseMenuContent = () => (
    <div style={{ minWidth: 200 }}>
      <div style={{ padding: '4px 0' }}>
        <GitHubShow
          githubUserProfile={githubUserProfile as GithubUserProfile}
          document={doc as DocumentWithoutContent}
          onClose={() => {}}
          setGithubRepoUrl={setGithubRepoUrl}
          githubRepoUrl={githubRepoUrl}
          isGithubConnected={isGithubConnected}
          toolbarDisabled={toolbarDisabled}
          isReadOnly={isReadOnly}
          onRefresh={forceRefresh}
        />
      </div>
      <div style={{ padding: '4px 0' }}>
        <BitbucketShow
          bitbucketUserProfile={bitbucketUserProfile as BitbucketUserProfile}
          document={doc as DocumentWithoutContent}
          onClose={() => {}}
          setBitbucketRepoUrl={setBitbucketRepoUrl}
          bitbucketRepoUrl={bitbucketRepoUrl}
          isBitbucketConnected={isBitbucketConnected}
          toolbarDisabled={toolbarDisabled}
          isReadOnly={isReadOnly}
          onRefresh={forceRefresh}
        />
      </div>
    </div>
  );

  const handlePublish = async () => {
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      if (updateDoc) {
        updateDoc({} as React.MouseEvent<HTMLButtonElement>, true, true);
      }
    } catch (error: any) {
      console.error('Publish error:', error);
      message.error(error.message || t('toolbar.publishFailed'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishToWeb = async () => {
    if (isPublishing) return;

    setIsPublishing(true);
    // track event
    trackEvent('publishProduct', {
      distinct_id: user.email,
      payload: JSON.stringify({
        documentId: doc?.id,
        documentType: doc?.type,
      }),
    });
    try {
      if (doc?.type === 'PROTOTYPE' && onDeploy) {
        onDeploy();
      } else if (doc?.type === DOCTYPE.PRODUCT) {
        // Publish PRODUCT to production
        const deployDocId = generateDeployDocId(
          doc?.name || '',
          doc?.type || '',
          doc?.id || ''
        );

        // Parse files from doc contents
        let files = [];
        try {
          const contents = JSON.parse(doc.contents || '{}');
          files = contents.files || [];
        } catch (err) {
          console.error('Failed to parse document contents:', err);
          message.error(t('document.failedToParseContents'));
          setIsPublishing(false);
          return;
        }

        if (!files.length) {
          message.error(t('document.noFilesToPublish'));
          setIsPublishing(false);
          return;
        }

        const messageKey = 'publish-production';
        message.loading({
          content: t('toolbar.publishingToProduction'),
          key: messageKey,
          duration: 0,
        });

        const result = await publishToProduction(
          doc.id,
          deployDocId,
          files,
          (progressData) => {
            console.log('Publish progress callback:', progressData);

            // Update loading message with progress
            if (progressData.status?.message) {
              const statusMessage = translateStatusMessage(
                progressData.status.message,
                t
              );
              message.loading({
                content: statusMessage,
                key: messageKey,
                duration: 0,
              });
            }

            // Handle completion - check for success with sourceUrl
            if (progressData.success === true && progressData.sourceUrl) {
              console.log(
                'Publish completed successfully, refreshing document'
              );
              message.destroy(messageKey);
              message.success(t('toolbar.publishedSuccessfully'));
              // Automatically refresh document to show updated publishUrl
              if (updateDoc) {
                updateDoc(
                  {} as React.MouseEvent<HTMLButtonElement>,
                  true,
                  false
                );
              }
            } else if (progressData.error) {
              console.log('Publish error:', progressData.error);
              message.destroy(messageKey);
              message.error(progressData.error || t('toolbar.publishFailed'));
            }
          }
        );

        console.log('Publish final result:', result);

        // Handle final result if not already handled in progress callback
        if (result.success) {
          // Always refresh document to show latest publishUrl
          // Add 10s delay to allow deployment to fully complete on Vercel
          setTimeout(() => {
            // If we have sourceUrl, it was already handled in progress callback
            // But if we don't have sourceUrl (e.g., JSON parsing error but publish succeeded),
            // we still need to refresh and show success
            if (!result.sourceUrl) {
              message.destroy(messageKey);
              message.success(t('toolbar.publishedSuccessfully'));
            }
            if (updateDoc) {
              updateDoc({} as React.MouseEvent<HTMLButtonElement>, true, false);
            }
          }, 7500);
        } else if (!result.success) {
          message.destroy(messageKey);
          message.error(result.error || t('toolbar.publishFailed'));
        }
      } else {
        if (updateDoc) {
          updateDoc({} as React.MouseEvent<HTMLButtonElement>, true, true);
        }
      }
    } catch (error: any) {
      console.error('Publish error:', error);
      message.destroy('publish-production');
      message.error(error.message || t('toolbar.publishFailed'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleTogglePublishPopover = () => {
    setPublishPopoverOpen(!publishPopoverOpen);
  };

  const mobileMenuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [];

    // Codebase (GitHub/Bitbucket) - for PROTOTYPE/PRODUCT
    if (
      (doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT) &&
      docActions.includes(DocumentToolBarActions.Codebase)
    ) {
      items.push({
        key: 'codebase',
        label: (
          <>
            <GithubOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('toolbar.connectToCodeRepo')}
          </>
        ),
        onClick: () => {
          setCodebasePopoverOpen(true);
        },
        disabled: isReadOnly || toolbarDisabled,
      });
    }

    // Save Changes - for PROTOTYPE/PRODUCT
    if (
      (doc?.type === DOCTYPE.PROTOTYPE || doc?.type === DOCTYPE.PRODUCT) &&
      saveButtonState
    ) {
      items.push({
        key: 'save',
        label: (
          <>
            <SaveOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('prototypeEditor.deployChange')}
          </>
        ),
        onClick: () => {
          if (
            saveButtonState.hasFiles &&
            saveButtonState.hasUnsavedChanges &&
            !saveButtonState.isReadOnly &&
            !saveButtonState.isEditing &&
            !isWorkflowStepPageWithoutContent
          ) {
            saveButtonState.onSave();
          }
        },
        disabled:
          !saveButtonState.hasFiles ||
          saveButtonState.isEditing ||
          saveButtonState.isReadOnly ||
          !saveButtonState.hasUnsavedChanges ||
          isWorkflowStepPageWithoutContent,
      });
    }

    // Publish - for non-PROTOTYPE/PRODUCT
    if (
      doc?.type !== DOCTYPE.PROTOTYPE &&
      doc?.type !== DOCTYPE.PRODUCT &&
      docActions.includes(DocumentToolBarActions.Publish)
    ) {
      items.push({
        key: 'publish',
        label: (
          <>
            <CloudUploadOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('toolbar.publish')}
          </>
        ),
        onClick: handlePublish,
        disabled:
          isReadOnly ||
          toolbarDisabled ||
          isPublishing ||
          isWorkflowStepPageWithoutContent,
      });
    }

    // Export - for non-PROTOTYPE/PRODUCT
    if (
      doc?.type !== DOCTYPE.PROTOTYPE &&
      doc?.type !== DOCTYPE.PRODUCT &&
      docActions.includes(DocumentToolBarActions.Export) &&
      !centerActions
    ) {
      items.push({
        key: 'export-pdf',
        label: (
          <>
            <FilePdfOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('toolbar.exportPdf')}
          </>
        ),
        onClick: handleExportPdfV1,
        disabled: isWorkflowStepPageWithoutContent,
      });
      items.push({
        key: 'export-docx',
        label: (
          <>
            <FileOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('toolbar.exportDocx')}
          </>
        ),
        onClick: handleExportDocxV1,
        disabled: isWorkflowStepPageWithoutContent,
      });
    }

    // Make Prototype - for PRD
    if (doc?.type === DOCTYPE.PRD) {
      items.push({
        key: 'make-prototype',
        label: (
          <>
            <span
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            >
              ⚡
            </span>
            {t('button.makePrototype')}
          </>
        ),
        onClick: () => handleConvertToApp?.(PROTOTYPE_TYPE_FRONTEND),
        disabled:
          isReadOnly ||
          toolbarDisabled ||
          isStreaming ||
          isGeneratingDoc ||
          isWorkflowStepPageWithoutContent,
      });
    }

    // Make Product - for PROTOTYPE
    if (doc?.type === DOCTYPE.PROTOTYPE) {
      items.push({
        key: 'make-product',
        label: (
          <>
            <span
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            >
              ⚡
            </span>
            {t('toolbar.makeProduct')}
          </>
        ),
        onClick: () => handleConvertToApp?.(PRODUCT_TYPE_FULLSTACK),
        disabled:
          isReadOnly ||
          toolbarDisabled ||
          isStreaming ||
          isGeneratingDoc ||
          isWorkflowStepPageWithoutContent,
      });
    }

    // Publish App - for PRODUCT
    if (doc?.type === DOCTYPE.PRODUCT) {
      items.push({
        key: 'publish-app',
        label: (
          <>
            <CloudUploadOutlined
              style={{
                color: COLORS.PRIMARY,
                fontSize: 18,
                marginRight: '4px',
              }}
            />
            {t('toolbar.publishApp')}
          </>
        ),
        onClick: () => {
          setPublishPopoverOpen(true);
        },
        disabled:
          isReadOnly ||
          toolbarDisabled ||
          isStreaming ||
          isGeneratingDoc ||
          !doc?.contents ||
          isWorkflowStepPageWithoutContent,
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc?.type,
    doc?.contents,
    docActions,
    saveButtonState,
    centerActions,
    isReadOnly,
    toolbarDisabled,
    isPublishing,
    isStreaming,
    isGeneratingDoc,
    isWorkflowStepPageWithoutContent,
    handleConvertToApp,
    setCodebasePopoverOpen,
    setPublishPopoverOpen,
    t,
  ]);

  // Check if there's a newer preview version that hasn't been published
  const hasNewerPreview = (() => {
    if (doc?.type !== DOCTYPE.PRODUCT) return false;
    const meta = doc?.meta as any;
    const publishedAt = meta?.publishedAt;
    const previewUpdatedAt = meta?.previewUpdatedAt;
    if (!publishedAt || !previewUpdatedAt) return false;
    const pAt = new Date(publishedAt).getTime();
    const prevAt = new Date(previewUpdatedAt).getTime();
    if (Number.isNaN(pAt) || Number.isNaN(prevAt)) return false;
    return prevAt > pAt;
  })();

  function handleCreateDevPlan() {
    setMakeProductModalOpen(true);
  }

  async function handleCreateDevPlanSubmit(
    roles: string[],
    teammateIds: string[]
  ) {
    if (!project) {
      message.error('Project not found. Cannot create a development plan.');
      return;
    }

    const devPlanDoc = project.documents.find(
      (d) => d.type === DOCTYPE.DEVELOPMENT_PLAN
    );

    if (!devPlanDoc) {
      message.error(t('document.devPlanNotExist'));
      return;
    }
    setMakeProductLoading(true);
    try {
      // Set the data in the global store
      setMakeProductData({ roles, teammateIds });
      // Close the modal
      setMakeProductModalOpen(false);
      // Redirect to the dev plan editor
      navigate(`/devplan/${devPlanDoc.id}`);
    } catch (err) {
      message.error(t('document.failedToPrepareDevPlan'));
    } finally {
      setMakeProductLoading(false);
    }
  }

  return (
    <Flex
      className="document-toolbar"
      justify={isMobile || isTablet ? 'space-between' : 'space-between'}
      align={'center'}
      wrap={isMobile || isTablet ? 'wrap' : 'nowrap'}
      style={{
        width: '100%',
        position: 'relative',
        gap: isMobile || isTablet ? '8px' : 0,
        padding: isMobile || isTablet ? '4px 0' : 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: isMobile ? '6px' : '12px',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <AppBreadcrumb items={breadcrumbItems} />
        {!hideProgressBar && (
          <>
            <span style={{ color: '#8c8c8c', margin: '0 4px' }}>&gt;</span>
            <ProjectStep
              docType={doc?.type}
              projectId={doc?.projectId as string}
            />
          </>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {onToggleHistory && !isMobile && (
            <Tooltip title={t('document.viewDocumentHistory')}>
              <Button
                type="text"
                icon={<ClockCircleOutlined />}
                onClick={onToggleHistory}
                style={{
                  padding: '4px',
                  minWidth: 'auto',
                  height: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}
          {onToggleSidepanel && !isMobile && (
            <Tooltip
              title={
                isSidepanelVisible
                  ? t('document.hideSidepanel') || 'Hide sidepanel'
                  : t('document.showSidepanel') || 'Show sidepanel'
              }
            >
              <Button
                type="text"
                icon={
                  isSidepanelVisible ? (
                    <PanelLeftClose size={16} />
                  ) : (
                    <PanelLeftOpen size={16} />
                  )
                }
                onClick={onToggleSidepanel}
                style={{
                  padding: '4px',
                  minWidth: 'auto',
                  height: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}
        </div>
      </div>
      {/* Center actions section - hidden on smaller screens */}
      {!isMobile && !isTablet && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {centerActions
            ? centerActions
            : doc?.type !== DOCTYPE.PROTOTYPE &&
              doc?.type !== DOCTYPE.PRODUCT &&
              docActions.includes(DocumentToolBarActions.Share) && (
                <Tooltip
                  title={
                    isReadOnly ? viewOnlyMessage : t('toolbar.shareProject')
                  }
                >
                  <Button
                    type="text"
                    onClick={handleShareDoc}
                    disabled={
                      isReadOnly ||
                      toolbarDisabled ||
                      isWorkflowStepPageWithoutContent
                    }
                    style={{
                      borderRadius: '16px',
                      padding: '4px 12px',
                      height: '32px',
                      border: 'none',
                      backgroundColor:
                        isReadOnly ||
                        toolbarDisabled ||
                        isWorkflowStepPageWithoutContent
                          ? 'transparent'
                          : '#F0EDFF',
                      color:
                        isReadOnly ||
                        toolbarDisabled ||
                        isWorkflowStepPageWithoutContent
                          ? '#ccc'
                          : '#5345F3',
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
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
          marginLeft: isMobile || isTablet ? 'auto' : 0,
        }}
      >
        {!!docActions.length && (
          <Flex
            align="center"
            justify="flex-end"
            className="breadcrumb-buttons"
            wrap={isTablet ? 'wrap' : 'nowrap'}
            gap={isTablet ? 4 : 10}
          >
            {isMobile ? (
              <Dropdown menu={{ items: mobileMenuItems }} trigger={['click']}>
                <Button
                  type="link"
                  disabled={isReadOnly || toolbarDisabled}
                  style={{
                    padding: 0,
                    color: 'black',
                    height: 24,
                    width: 24,
                    borderRadius: '100%',
                    background: '#e4e4e4',
                    opacity: isReadOnly || toolbarDisabled ? 0.5 : 1.0,
                  }}
                >
                  <EllipsisOutlined
                    style={{
                      rotate: '90deg',
                      fontSize: 16,
                    }}
                  />
                </Button>
              </Dropdown>
            ) : (
              <>
                {doc?.type === DOCTYPE.PROTOTYPE && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: isReadOnly || toolbarDisabled ? 0.5 : 1.0,
                    }}
                  ></div>
                )}

                {(doc?.type === DOCTYPE.PROTOTYPE ||
                  doc?.type === DOCTYPE.PRODUCT) &&
                  docActions.includes(DocumentToolBarActions.Codebase) &&
                  (!isTablet || window.innerWidth > 1000) && (
                    <Tooltip
                      title={
                        isReadOnly
                          ? viewOnlyMessage
                          : t('toolbar.connectToCodeRepo')
                      }
                    >
                      {(() => {
                        return (
                          bitbucketRepoUrl &&
                          bitbucketRepoUrl.includes('bitbucket')
                        );
                      })() ? (
                        <BitbucketShow
                          key={`bitbucket-${bitbucketRepoUrl}-${refreshTrigger}`}
                          bitbucketUserProfile={
                            bitbucketUserProfile as BitbucketUserProfile
                          }
                          document={doc as DocumentWithoutContent}
                          onClose={() => {}}
                          setBitbucketRepoUrl={setBitbucketRepoUrl}
                          bitbucketRepoUrl={bitbucketRepoUrl}
                          isBitbucketConnected={isBitbucketConnected}
                          toolbarDisabled={toolbarDisabled}
                          isReadOnly={isReadOnly}
                          onRefresh={forceRefresh}
                        />
                      ) : (() => {
                          return (
                            githubRepoUrl && githubRepoUrl.includes('github')
                          );
                        })() ? (
                        <GitHubShow
                          key={`github-${githubRepoUrl}-${refreshTrigger}`}
                          githubUserProfile={
                            githubUserProfile as GithubUserProfile
                          }
                          document={doc as DocumentWithoutContent}
                          onClose={() => {}}
                          setGithubRepoUrl={setGithubRepoUrl}
                          githubRepoUrl={githubRepoUrl}
                          isGithubConnected={isGithubConnected}
                          toolbarDisabled={toolbarDisabled}
                          isReadOnly={isReadOnly}
                          onRefresh={forceRefresh}
                        />
                      ) : (
                        (() => {
                          return (
                            <Popover
                              key={`codebase-${githubRepoUrl}-${bitbucketRepoUrl}-${refreshTrigger}`}
                              content={getCodebaseMenuContent()}
                              trigger="click"
                              open={codebasePopoverOpen}
                              onOpenChange={setCodebasePopoverOpen}
                              placement="bottomLeft"
                            >
                              <Button
                                type="link"
                                style={{ padding: 0, color: 'black' }}
                              >
                                <GithubOutlined
                                  style={{
                                    color: COLORS.PRIMARY,
                                    fontSize: 18,
                                  }}
                                />
                                {/* {t('toolbar.codebase')} */}
                              </Button>
                            </Popover>
                          );
                        })()
                      )}
                    </Tooltip>
                  )}
                {/* Save Changes button for prototype/product pages */}
                {(doc?.type === DOCTYPE.PROTOTYPE ||
                  doc?.type === DOCTYPE.PRODUCT) &&
                  saveButtonState &&
                  (!isTablet || window.innerWidth > 1000) && (
                    <Tooltip
                      title={
                        saveButtonState.isReadOnly
                          ? viewOnlyMessage
                          : !saveButtonState.hasUnsavedChanges
                            ? t('prototypeEditor.noChangesToSave')
                            : t('prototypeEditor.deployChange')
                      }
                    >
                      <Button
                        type="link"
                        style={{
                          padding: 0,
                          color: 'black',
                          opacity:
                            !saveButtonState.hasFiles ||
                            !saveButtonState.hasUnsavedChanges ||
                            saveButtonState.isReadOnly ||
                            saveButtonState.isEditing ||
                            isWorkflowStepPageWithoutContent
                              ? 0.5
                              : 1.0,
                        }}
                        onClick={saveButtonState.onSave}
                        disabled={
                          !saveButtonState.hasFiles ||
                          saveButtonState.isEditing ||
                          saveButtonState.isReadOnly ||
                          !saveButtonState.hasUnsavedChanges ||
                          isWorkflowStepPageWithoutContent
                        }
                      >
                        <SaveOutlined
                          style={{ color: COLORS.PRIMARY, fontSize: 16 }}
                        />
                        {/* {t('toolbar.save')} */}
                      </Button>
                    </Tooltip>
                  )}
                {doc?.type !== DOCTYPE.PROTOTYPE &&
                  doc?.type !== DOCTYPE.PRODUCT &&
                  docActions.includes(DocumentToolBarActions.Publish) &&
                  (!isTablet || window.innerWidth > 1100) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity:
                          isReadOnly ||
                          toolbarDisabled ||
                          isWorkflowStepPageWithoutContent
                            ? 0.5
                            : 1.0,
                      }}
                    >
                      <Tooltip
                        title={
                          isReadOnly
                            ? viewOnlyMessage
                            : t('toolbar.publishDocument')
                        }
                      >
                        <Button
                          type="link"
                          style={{ padding: 0, color: 'black' }}
                          disabled={
                            isReadOnly ||
                            toolbarDisabled ||
                            isPublishing ||
                            isWorkflowStepPageWithoutContent
                          }
                          onClick={handlePublish}
                        >
                          <CloudUploadOutlined
                            style={{
                              fontSize: 18,
                              color: COLORS.PRIMARY,
                            }}
                          />
                          {/* {isPublishing
                            ? t('toolbar.publishing')
                            : t('toolbar.publish')} */}
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                {doc?.type !== DOCTYPE.PROTOTYPE &&
                  doc?.type !== DOCTYPE.PRODUCT &&
                  docActions.includes(DocumentToolBarActions.Export) &&
                  !centerActions &&
                  (!isTablet || window.innerWidth > 1200) && (
                    <Dropdown
                      menu={{ items: exportMenuItems }}
                      trigger={['hover']}
                      disabled={isWorkflowStepPageWithoutContent}
                    >
                      <Button
                        type="link"
                        style={{
                          padding: 0,
                          color: 'black',
                          opacity: isWorkflowStepPageWithoutContent ? 0.5 : 1.0,
                        }}
                        disabled={isWorkflowStepPageWithoutContent}
                      >
                        <ExportOutlined
                          style={{
                            color: COLORS.PRIMARY,
                            fontSize: 18,
                          }}
                        />
                        {/* {t('toolbar.export')} */}
                      </Button>
                    </Dropdown>
                  )}

                {doc?.type === DOCTYPE.PRD && (
                  <Tooltip
                    title={
                      isReadOnly
                        ? viewOnlyMessage
                        : isStreaming || isGeneratingDoc
                          ? t('toolbar.waitForGeneration')
                          : t('toolbar.turnPrdToPrototype')
                    }
                  >
                    <Button
                      type="primary"
                      className="toolbar-main-ctn-btn"
                      onClick={() =>
                        handleConvertToApp?.(PROTOTYPE_TYPE_FRONTEND)
                      }
                      disabled={
                        isReadOnly ||
                        toolbarDisabled ||
                        isStreaming ||
                        isGeneratingDoc ||
                        isWorkflowStepPageWithoutContent
                      }
                      style={{
                        opacity:
                          isReadOnly ||
                          toolbarDisabled ||
                          isStreaming ||
                          isGeneratingDoc ||
                          isWorkflowStepPageWithoutContent
                            ? 0.5
                            : 1.0,
                      }}
                    >
                      {t('button.makePrototype')}
                    </Button>
                  </Tooltip>
                )}
                {doc?.type === DOCTYPE.PROTOTYPE && (
                  <>
                    <Tooltip
                      title={
                        isReadOnly
                          ? viewOnlyMessage
                          : isStreaming || isGeneratingDoc
                            ? t('toolbar.waitForGeneration')
                            : t('toolbar.turnPrototypeToApp')
                      }
                    >
                      <Button
                        type="primary"
                        className="toolbar-main-ctn-btn"
                        onClick={() =>
                          handleConvertToApp?.(PRODUCT_TYPE_FULLSTACK)
                        }
                        disabled={
                          isReadOnly ||
                          toolbarDisabled ||
                          isStreaming ||
                          isGeneratingDoc ||
                          isWorkflowStepPageWithoutContent
                        }
                        style={{
                          opacity:
                            isReadOnly ||
                            toolbarDisabled ||
                            isStreaming ||
                            isGeneratingDoc ||
                            isWorkflowStepPageWithoutContent
                              ? 0.5
                              : 1.0,
                        }}
                      >
                        {t('toolbar.makeProduct')}
                      </Button>
                    </Tooltip>
                  </>
                )}
                {doc?.type === DOCTYPE.PRODUCT && (
                  <>
                    <Popover
                      content={
                        <PublishPanel
                          documentId={doc?.id || ''}
                          documentName={doc?.name}
                          publishUrl={(doc?.meta as any)?.publishUrl}
                          publishedAt={(doc?.meta as any)?.publishedAt}
                          previewUpdatedAt={
                            (doc?.meta as any)?.previewUpdatedAt
                          }
                          onPublishToWeb={async () => {
                            await handlePublishToWeb();
                            setPublishPopoverOpen(false);
                          }}
                          onCreateDevPlan={() => {
                            handleCreateDevPlan();
                            setPublishPopoverOpen(false);
                          }}
                          onOpenDomainSettings={() => {
                            setPublishPopoverOpen(false);
                            openSettingsModalWithTab('domain');
                          }}
                          isPublishing={isPublishing}
                        />
                      }
                      trigger="click"
                      open={publishPopoverOpen}
                      onOpenChange={setPublishPopoverOpen}
                      placement="bottomRight"
                      overlayStyle={{ padding: 0 }}
                    >
                      <Tooltip
                        title={
                          isReadOnly
                            ? viewOnlyMessage
                            : isStreaming || isGeneratingDoc
                              ? t('toolbar.waitForGeneration')
                              : !doc?.contents
                                ? t('toolbar.firstCreateProduct')
                                : hasNewerPreview
                                  ? t('publish.previewNewerNotice')
                                  : ''
                        }
                      >
                        <Badge dot={hasNewerPreview} offset={[-5, 5]}>
                          <Button
                            type="primary"
                            className="toolbar-main-ctn-btn"
                            onClick={handleTogglePublishPopover}
                            disabled={
                              isReadOnly ||
                              toolbarDisabled ||
                              isStreaming ||
                              isGeneratingDoc ||
                              !doc?.contents ||
                              isWorkflowStepPageWithoutContent
                            }
                            style={{
                              width: '127px',
                              opacity:
                                isReadOnly ||
                                toolbarDisabled ||
                                isStreaming ||
                                isGeneratingDoc ||
                                !doc?.contents ||
                                isWorkflowStepPageWithoutContent
                                  ? 0.5
                                  : 1.0,
                            }}
                          >
                            {t('toolbar.publishApp')}
                          </Button>
                        </Badge>
                      </Tooltip>
                    </Popover>
                  </>
                )}
                <MakeProductModal
                  open={makeProductModalOpen}
                  onClose={() => setMakeProductModalOpen(false)}
                  onSubmit={handleCreateDevPlanSubmit}
                  teammates={teammates}
                  loading={makeProductLoading || teammatesLoading}
                />

                <DocumentSettingsModal
                  open={settingsModalVisible}
                  onClose={() => {
                    setSettingsModalVisible(false);
                    setSettingsModalInitialTab(undefined);
                  }}
                  initialDoc={doc}
                  deployDocId={generateDeployDocId(
                    doc?.name || '',
                    doc?.type || '',
                    doc?.id || ''
                  )}
                  isReadOnly={isReadOnly}
                  isCustomDomainLocked={isCustomDomainLocked}
                  initialActiveTab={settingsModalInitialTab}
                  onTriggerRedeployment={onDeploy}
                  onDocumentUpdated={handleDocumentUpdated}
                />
              </>
            )}
          </Flex>
        )}
      </div>
    </Flex>
  );
}

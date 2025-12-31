import React, { useCallback, useMemo } from 'react';
import {
  CheckCircleOutlined,
  DownOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { DOCTYPE, DocumentStatus, IssueStatus } from '@prisma/client';
import { Dropdown, MenuProps, Steps, Tooltip } from 'antd';
import { generatePath, useNavigate } from 'react-router-dom';

import { DocumentTypeNameMapping } from '../../containers/documents/types/documentTypes';
import { DevPlansPath, DocumentsPath } from '../../containers/nav/paths';
import { IssueBuildableTypes } from '../../containers/project/types/projectType';
import trackEvent from '../../trackingClient';
import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguage } from '../contexts/languageContext';
import { useProjectQuery } from '../hooks/useProjectsQuery';

import './ProjectStep.scss';

const getDocStatusToStepStatus = (
  t: (key: string) => string
): Record<DocumentStatus, string> => ({
  [DocumentStatus.CREATED]: t('common.wait'),
  [DocumentStatus.INREVIEW]: t('common.process'),
  [DocumentStatus.PUBLISHED]: t('common.finish'),
  [DocumentStatus.APPROVED]: t('common.finish'),
  [DocumentStatus.CANCELED]: t('common.error'),
  [DocumentStatus.ARCHIVED]: t('common.error'),
});

type ProjectStepProps = {
  docType?: string;
  projectId?: string;
  noHighlight?: boolean; // Add this prop to disable highlighting
};

const ProjectStep: React.FC<ProjectStepProps> = ({
  docType = 'PRD',
  projectId = '',
  noHighlight = false,
}) => {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const hasValidProjectId = !!projectId && projectId !== 'undefined';
  const { data: project, isLoading } = useProjectQuery(projectId);

  // Map buildable issue names to document types
  const buildableNameToDocType: Record<string, DOCTYPE> = useMemo(
    () => ({
      [IssueBuildableTypes.PRD]: DOCTYPE.PRD,
      [IssueBuildableTypes.UIDESIGN]: DOCTYPE.UI_DESIGN,
      [IssueBuildableTypes.PROTOTYPE]: DOCTYPE.PROTOTYPE,
      [IssueBuildableTypes.TECHDESIGN]: DOCTYPE.TECH_DESIGN,
      [IssueBuildableTypes.DEVELOPMENT]: DOCTYPE.DEVELOPMENT_PLAN,
      [IssueBuildableTypes.QA]: DOCTYPE.QA_PLAN,
      [IssueBuildableTypes.RELEASE]: DOCTYPE.RELEASE_PLAN,
      [IssueBuildableTypes.PROPOSAL]: DOCTYPE.PROPOSAL,
      PRODUCT: DOCTYPE.PRODUCT,
    }),
    []
  );

  const docStatusToStepStatus = getDocStatusToStepStatus(t);
  const documentTypeNameMapping = DocumentTypeNameMapping(t);

  // Get all active buildables from project
  const activeBuildables = useMemo(() => {
    if (!project?.buildables) return [];
    return project.buildables.filter(
      (buildable) =>
        buildable.status !== IssueStatus.CANCELED &&
        buildable.status !== IssueStatus.OVERWRITTEN
    );
  }, [project?.buildables]);

  // Build docTypeToIdMap from fetched project documents and buildables
  const docTypeToIdStatusMap = useMemo(() => {
    const map = {} as Record<
      string,
      { docId: string; docType: string; buildableId?: string }
    >;

    // First, map documents by their type
    if (project?.documents) {
      project.documents.forEach((doc) => {
        const docTypeKey = doc.type;
        map[docTypeKey] = {
          docId: doc.id,
          docType: docStatusToStepStatus[doc.status] as string,
        };
      });
    }

    // Then, map buildables to their documents
    if (project?.buildables) {
      project.buildables.forEach((buildable) => {
        const docType = buildableNameToDocType[buildable.name];
        if (docType) {
          // Find document for this buildable by matching type and issueId
          // Documents are linked to issues via issueId field
          const doc = project.documents?.find(
            (d) => d.type === docType && (d as any).issueId === buildable.id
          );
          if (doc) {
            map[buildable.name] = {
              docId: doc.id,
              docType: docStatusToStepStatus[doc.status] as string,
              buildableId: buildable.id,
            };
          } else {
            // If no document exists yet, still track the buildable
            map[buildable.name] = {
              docId: '',
              docType: 'wait',
              buildableId: buildable.id,
            };
          }
        }
      });
    }

    return map;
  }, [
    project?.documents,
    project?.buildables,
    docStatusToStepStatus,
    buildableNameToDocType,
  ]);

  const handleNavigate = useCallback(
    (buildableNameOrDocType: string) => {
      const docInfo = docTypeToIdStatusMap[buildableNameOrDocType];
      const docType =
        buildableNameToDocType[buildableNameOrDocType] ||
        (buildableNameOrDocType as DOCTYPE);

      if (!docInfo || !docInfo.docId) {
        // If document doesn't exist, navigate to the project documents page
        if (projectId) {
          navigate(generatePath(DocumentsPath, { projectId }));
        }
        return;
      }

      const docId = docInfo.docId;
      if (docType === DOCTYPE.DEVELOPMENT_PLAN) {
        navigate(`/${DevPlansPath}/${docId}`, {
          state: { autoCollapseSidepanel: true },
        });
      } else {
        navigate(`/docs/${docId}`, {
          state: { autoCollapseSidepanel: true },
        });
      }
    },
    [docTypeToIdStatusMap, buildableNameToDocType, projectId, navigate]
  );

  const getStepLabel = useCallback(
    (buildableNameOrDocType: string) => {
      const docType =
        buildableNameToDocType[buildableNameOrDocType] ||
        (buildableNameOrDocType as DOCTYPE);
      const typeMapping = documentTypeNameMapping[docType];
      return typeMapping?.name || buildableNameOrDocType;
    },
    [buildableNameToDocType, documentTypeNameMapping]
  );

  const getStepDescription = useCallback(
    (buildableNameOrDocType: string) => {
      const docType =
        buildableNameToDocType[buildableNameOrDocType] ||
        (buildableNameOrDocType as DOCTYPE);
      const typeMapping = documentTypeNameMapping[docType];
      return typeMapping?.subTitle || '';
    },
    [buildableNameToDocType, documentTypeNameMapping]
  );

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'finish':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'process':
        return '●';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  }, []);

  // Build dropdown menu items from active buildables
  const menuItems: MenuProps['items'] = useMemo(() => {
    // Sort buildables by sequence from meta
    const sortedBuildables = [...activeBuildables].sort((a, b) => {
      const aMeta = a.meta as { sequence?: number };
      const bMeta = b.meta as { sequence?: number };
      return (aMeta?.sequence || 0) - (bMeta?.sequence || 0);
    });

    return sortedBuildables.map((buildable) => {
      const buildableName = buildable.name;
      const docInfo = docTypeToIdStatusMap[buildableName];
      const status = (docInfo?.docType || 'wait') as
        | 'wait'
        | 'process'
        | 'finish'
        | 'error';
      const isCurrent = docType === buildableNameToDocType[buildableName];
      const statusIcon = getStatusIcon(status);

      return {
        key: buildableName,
        label: (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: isCurrent ? 600 : 400,
            }}
            onClick={() => {
              if (projectId) {
                trackEvent('projectStepClick', {
                  distinct_id: user.email,
                  payload: JSON.stringify({
                    buildableName,
                    documentId: docInfo?.docId,
                    buildableId: buildable.id,
                  }),
                });
                handleNavigate(buildableName);
              }
            }}
          >
            {typeof statusIcon === 'string' ? (
              <span>{statusIcon}</span>
            ) : (
              statusIcon
            )}
            <span>{getStepLabel(buildableName)}</span>
            {getStepDescription(buildableName) && (
              <Tooltip title={getStepDescription(buildableName)}>
                <InfoCircleOutlined
                  style={{
                    color: 'lightgray',
                    fontSize: 12,
                    marginLeft: '4px',
                  }}
                />
              </Tooltip>
            )}
          </span>
        ),
      };
    });
  }, [
    activeBuildables,
    docTypeToIdStatusMap,
    docType,
    projectId,
    user.email,
    buildableNameToDocType,
    getStepLabel,
    getStepDescription,
    handleNavigate,
    getStatusIcon,
  ]);

  // Determine current step label
  const currentStepLabel = useMemo(() => {
    if (docType) {
      const buildableName = Object.entries(buildableNameToDocType).find(
        ([, dt]) => dt === docType
      )?.[0];
      if (buildableName) {
        const docTypeForLabel =
          buildableNameToDocType[buildableName] || (buildableName as DOCTYPE);
        const typeMapping = documentTypeNameMapping[docTypeForLabel];
        return typeMapping?.name || buildableName;
      }
      const typeMapping = documentTypeNameMapping[docType as DOCTYPE];
      return typeMapping?.name || docType;
    }
    // Default to first buildable or PRD
    if (activeBuildables.length > 0) {
      const firstBuildable = activeBuildables[0];
      const docTypeForLabel = buildableNameToDocType[firstBuildable.name];
      const typeMapping = documentTypeNameMapping[docTypeForLabel];
      return typeMapping?.name || firstBuildable.name;
    }
    return t('common.prd');
  }, [
    docType,
    activeBuildables,
    documentTypeNameMapping,
    buildableNameToDocType,
    t,
  ]);

  // Show loading only if we have a valid projectId and the query is actually loading
  if (hasValidProjectId && isLoading) {
    return <span>{t('common.loading')}</span>;
  }

  // If no projectId, show the 3-step progress bar: PRD -> Prototype -> Product
  if (!hasValidProjectId) {
    const prdName =
      documentTypeNameMapping[DOCTYPE.PRD]?.name || t('common.prd');
    const prototypeName =
      documentTypeNameMapping[DOCTYPE.PROTOTYPE]?.name || 'Prototype';
    const productName =
      documentTypeNameMapping[DOCTYPE.PRODUCT]?.name || 'Product';

    // Determine current step based on docType prop
    let currentStep = 0;
    if (docType === DOCTYPE.PROTOTYPE) {
      currentStep = 1;
    } else if (docType === DOCTYPE.PRODUCT) {
      currentStep = 2;
    }

    const prdSubtitle =
      documentTypeNameMapping[DOCTYPE.PRD]?.subTitle ||
      'Collect and analyze product requirements';
    const prototypeSubtitle =
      documentTypeNameMapping[DOCTYPE.PROTOTYPE]?.subTitle ||
      'Generate fully functional prototypes';
    const productSubtitle = 'Build full-stack product and deploy';

    const stepsItems = [
      {
        title: (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {prdName}
            <Tooltip title={prdSubtitle}>
              <InfoCircleOutlined
                style={{
                  fontSize: '12px',
                  color: '#8c8c8c',
                  cursor: 'help',
                  position: 'relative',
                  left: '-3px',
                }}
              />
            </Tooltip>
          </span>
        ),
        status: (currentStep > 0
          ? 'finish'
          : currentStep === 0
            ? 'process'
            : 'wait') as 'finish' | 'process' | 'wait',
      },
      {
        title: (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {prototypeName}
            <Tooltip title={prototypeSubtitle}>
              <InfoCircleOutlined
                style={{
                  fontSize: '12px',
                  color: '#8c8c8c',
                  cursor: 'help',
                  position: 'relative',
                  left: '-3px',
                }}
              />
            </Tooltip>
          </span>
        ),
        status: (currentStep > 1
          ? 'finish'
          : currentStep === 1
            ? 'process'
            : currentStep < 1
              ? 'wait'
              : 'finish') as 'finish' | 'process' | 'wait',
      },
      {
        title: (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {productName}
            <Tooltip title={productSubtitle}>
              <InfoCircleOutlined
                style={{
                  fontSize: '12px',
                  color: '#8c8c8c',
                  cursor: 'help',
                  position: 'relative',
                  left: '-3px',
                }}
              />
            </Tooltip>
          </span>
        ),
        status: (currentStep === 2
          ? 'process'
          : currentStep < 2
            ? 'wait'
            : 'finish') as 'finish' | 'process' | 'wait',
      },
    ];

    return (
      <div
        className="project-step"
        style={{ width: '100%', maxWidth: '450px' }}
      >
        <Steps current={currentStep} items={stepsItems} size="default" />
      </div>
    );
  }

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      <span
        style={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '16px',
          padding: '4px 12px',
          height: '32px',
          border: 'none',
          backgroundColor: '#E6E1FF',
          color: '#5345F3',
          fontWeight: 500,
          transition: 'all 0.3s ease',
        }}
      >
        {currentStepLabel}
        <DownOutlined style={{ fontSize: 12 }} />
      </span>
    </Dropdown>
  );
};

export default ProjectStep;

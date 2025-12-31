import { useCallback, useState } from 'react';
import { Issue, IssueStatus, Prisma } from '@prisma/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Col, Row, Spin } from 'antd';

import { ProjectOutput } from '../../../../../../shared/types';
import { useAppModal } from '../../../../common/components/AppModal';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { PROJECT_QUERY_KEY } from '../../../../common/hooks/useProjectsQuery';
import { useUpdateIssueMutation } from '../../hooks/useIssueMutation';
import { IssueBuildableTypes } from '../../types/projectType';
import { useProject } from '../Project';
import { ProjectPlanCard } from './projectPlanCard/ProjectPlanCard';

import 'driver.js/dist/driver.css';

function getBuildableDescription(t: (key: string) => string) {
  return {
    [IssueBuildableTypes.PRD as string]: t('project.buildableDescriptionPrd'),
    [IssueBuildableTypes.UIDESIGN as string]: t(
      'project.buildableDescriptionUiDesign'
    ),
    [IssueBuildableTypes.PROTOTYPE as string]: t(
      'project.buildableDescriptionPrototype'
    ),
    [IssueBuildableTypes.TECHDESIGN as string]: t(
      'project.buildableDescriptionTechDesign'
    ),
    [IssueBuildableTypes.DEVELOPMENT as string]: t(
      'project.buildableDescriptionDevelopment'
    ),
    [IssueBuildableTypes.QA as string]: t('project.buildableDescriptionQa'),
    [IssueBuildableTypes.RELEASE as string]: t(
      'project.buildableDescriptionRelease'
    ),
  };
}

export function ProjectBuilder() {
  const { showAppModal } = useAppModal();
  const { project, access } = useProject();
  const isReadOnly = access.projectPermission === 'VIEW';
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  console.log('access', access);
  const projectContext = useProject();
  console.log('projectContext', projectContext, projectContext.filterMode);

  const buildables = [...project.buildables].sort((a, b) => {
    let aObj = a.meta as Prisma.JsonObject;
    let bObj = b.meta as Prisma.JsonObject;
    return (aObj.sequence as number) - (bObj.sequence as number);
  });

  const onIssueClick = useCallback(
    (e: React.MouseEvent<HTMLLIElement>) => {
      const { name, id, shortname: shortName } = e.currentTarget.dataset;
      console.log('Issue clicked:', id, shortName);
      showAppModal({
        type: name as IssueBuildableTypes,
        issueShortName: shortName as string,
      });
    },
    [showAppModal]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Spin spinning={isSubmitting}>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
        <Row
          gutter={[{ xs: 0, sm: 20, md: 0, lg: 20 }, 0]}
          style={{
            width: '100%',
            minHeight: 300,
            paddingTop: '16px',
            rowGap: '20px',
          }}
        >
          {buildables
            .filter((b) => b.status && b.status !== IssueStatus.CANCELED)
            .map((buildable) => (
              <Col
                xs={24}
                sm={12}
                md={24}
                lg={12}
                xl={8}
                xxl={6}
                key={buildable.id}
              >
                <ProjectPlanCard
                  elementId={buildable.name}
                  project={project}
                  access={access}
                  issue={buildable}
                  onClick={onIssueClick}
                />
              </Col>
            ))}
        </Row>
      </div>
    </Spin>
  );
}

function getBuildableName(name: string, t: (key: string) => string): string {
  const buildableNameMap: Record<string, string> = {
    PRD: t('project.buildablePrd'),
    UI_DESIGN: t('project.buildableUiDesign'),
    PROTOTYPE: t('project.buildablePrototype'),
    TECH_DESIGN: t('project.buildableTechDesign'),
    DEVELOPMENT_PLAN: t('project.buildableDevelopment'),
    QA_PLAN: t('project.buildableQa'),
    RELEASE_PLAN: t('project.buildableRelease'),
    BUSINESS_PROPOSAL: t('project.buildableProposal'),
    PRODUCT: t('project.buildableProduct'),
  };

  return buildableNameMap[name] || name.replace('_', ' ');
}

export function EditProjectWorkflow({
  project,
  onSuccess,
}: {
  project: ProjectOutput;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [loadingBuildableId, setLoadingBuildableId] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track changes: map of buildableId -> desired status (true = active, false = canceled)
  const [buildableChanges, setBuildableChanges] = useState<
    Record<string, boolean>
  >({});
  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      // Don't call onSuccess here - wait until all mutations complete
    },
    onError: (error) => {
      throw error;
    },
  });

  const isBuildableSelected = useCallback(
    (buildable: Issue) => {
      // If there's a change for this buildable, use the change
      if (buildable.id in buildableChanges) {
        return buildableChanges[buildable.id];
      }
      // Otherwise, use the current status (not CANCELED = selected)
      return buildable.status !== IssueStatus.CANCELED;
    },
    [buildableChanges]
  );

  const handleCheckboxChange = useCallback((buildable: Issue) => {
    setBuildableChanges((prev) => {
      const currentDesiredStatus =
        buildable.id in prev
          ? prev[buildable.id]
          : buildable.status !== IssueStatus.CANCELED;
      const newDesiredStatus = !currentDesiredStatus;

      // If the new status matches the original status, remove from changes
      const originalStatus = buildable.status !== IssueStatus.CANCELED;
      if (newDesiredStatus === originalStatus) {
        const { [buildable.id]: _, ...rest } = prev;
        return rest;
      }

      // Otherwise, record the change
      return {
        ...prev,
        [buildable.id]: newDesiredStatus,
      };
    });
  }, []);

  const handleSubmit = async () => {
    const changeCount = Object.keys(buildableChanges).length;
    if (isSubmitting || changeCount === 0) return;

    setIsSubmitting(true);
    try {
      for (const [buildableId, desiredStatus] of Object.entries(
        buildableChanges
      )) {
        const buildable = buildables.find((b) => b.id === buildableId);
        if (buildable) {
          const currentStatus = buildable.status !== IssueStatus.CANCELED;
          // Only update if the desired status is different from current
          if (desiredStatus !== currentStatus) {
            setLoadingBuildableId(buildableId);
            const newStatus = desiredStatus
              ? IssueStatus.CREATED
              : IssueStatus.CANCELED;
            await updateIssueMutation.mutateAsync({
              id: buildable.id,
              status: newStatus,
            });
            setLoadingBuildableId(null);
          }
        }
      }
      // Invalidate project query to refresh the UI after all mutations complete
      await queryClient.invalidateQueries([PROJECT_QUERY_KEY, project.id]);
      setBuildableChanges({});
      // Close modal and refresh UI after all mutations are done
      onSuccess();
    } catch (error) {
      console.error('Error updating workflow:', error);
      setLoadingBuildableId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildables = [...project.buildables]
    .filter((b) => b.name !== 'UI_DESIGN')
    .sort((a, b) => {
      let aObj = a.meta as Prisma.JsonObject;
      let bObj = b.meta as Prisma.JsonObject;
      return (aObj.sequence as number) - (bObj.sequence as number);
    });

  return (
    <div>
      {buildables.map((buildable) => {
        return (
          <div
            key={buildable.id}
            style={{
              margin: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={isBuildableSelected(buildable)}
              onChange={() => handleCheckboxChange(buildable)}
              disabled={loadingBuildableId === buildable.id || isSubmitting}
            />
            <label>{getBuildableName(buildable.name, t)}</label>
            {loadingBuildableId === buildable.id && <Spin size="small" />}
          </div>
        );
      })}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={Object.keys(buildableChanges).length === 0}
        >
          {t('project.submitChanges')}
        </Button>
      </div>
    </div>
  );
}

import { useCallback, useState } from 'react';
import {
  ApartmentOutlined,
  CheckOutlined,
  InfoCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { DOCTYPE, IssueStatus, Prisma, SubscriptionTier } from '@prisma/client';
import { Button, Flex, Radio, Space, Tabs, Tag, Tooltip } from 'antd';
import {
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router';

import {
  ProjectAccessResponse,
  ProjectOutput,
} from '../../../../../shared/types';
import AppBreadcrumb from '../../../common/components/AppBreadcrumb';
import { useAppModal } from '../../../common/components/AppModal';
import {
  FREE_PROJECT_LIMIT,
  getViewOnlyMessage,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import {
  useProjectAccessQuery,
  useProjectQuery,
} from '../../../common/hooks/useProjectsQuery';
import { isFeatureLocked } from '../../../common/util/app';
import { GlobalStoreInst } from '../../../common/util/globalStore';
import { COLORS } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { BuildingPath, PlanningPath, ReportingPath } from '../../nav/paths';
import { createJiraProject } from '../../organization/api/jiraApi';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import { JiraEntity } from '../../organization/types/jiraTypes';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { useBoardFilterMode } from '../hooks/useBoardFilterMode';
import ProjectDropdownMenu from './ProjectDropdownMenu';

const useTabItems = () => {
  const { t } = useLanguage();
  return [
    {
      key: PlanningPath,
      label: (
        <Flex align="center" gap={4}>
          {t('project.planner')}
          <Tooltip title="The end to end workboard for building your product with AI">
            <InfoCircleOutlined
              style={{ fontSize: 12, color: '#8c8c8c', cursor: 'help' }}
            />
          </Tooltip>
        </Flex>
      ),
    },
    {
      key: BuildingPath,
      label: (
        <Flex align="center" gap={4}>
          {t('project.builder')}
          <Tooltip title="Break down project into tasks for team collaboration">
            <InfoCircleOutlined
              style={{ fontSize: 12, color: '#8c8c8c', cursor: 'help' }}
            />
          </Tooltip>
        </Flex>
      ),
    },
    {
      key: ReportingPath,
      label: (
        <Flex align="center" gap={4}>
          {t('project.reporter')}
          <Tooltip title="Gain insights for product risks and recommendations">
            <InfoCircleOutlined
              style={{ fontSize: 12, color: '#8c8c8c', cursor: 'help' }}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];
};

function useProjectIdParam() {
  const { id } = useParams();
  if (!id) {
    throw new Error('Please select a project');
  }
  return id;
}

function useActiveTabKey(): string {
  const location = useLocation();
  const pathComponents = location.pathname.split('/');
  // Note: the pathname starts with a / so the first pathComponent will be empty
  return pathComponents.length >= 4 ? pathComponents[3] : PlanningPath;
}

type ContextType = Readonly<{
  project: ProjectOutput;
  filterMode: string;
  access: ProjectAccessResponse;
}>;
export function useProject() {
  return useOutletContext<ContextType>();
}

export function ProjectIndex() {
  // TODO - look at the project visa useProject and decide which tab to show first

  return redirect(PlanningPath);
}

export function Project() {
  const projectId = useProjectIdParam();
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = useActiveTabKey();
  const [boardMode, setBoardMode] = useBoardFilterMode();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { showAppModal } = useAppModal();
  const tabItems = useTabItems();
  const { t } = useLanguage();
  const { data: userProfile } = useUserProfileQuery(user.id);
  const { data: organization } = useOrganizationHierarchy();
  const [syncButtonEnabled, setSyncButtonEnabled] = useState(true);
  const [syncError, setSyncError] = useState(false);

  // Hide ProjectStep on planning/builder route
  const isBuilderRoute = location.pathname.includes('/planning/builder');
  // const isLocked = isFeatureLocked(
  //   subscriptionStatus as string,
  //   subscriptionTier as string
  // );

  const isLocked = false; // disable paywall gating for now

  const onTabChange = useCallback(
    (key: string) => {
      console.log('Navigating to ' + key);
      navigate(key);
    },
    [navigate]
  );

  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    error: projectError,
  } = useProjectQuery(projectId);

  const {
    data: access,
    isLoading: isAccessLoading,
    isError: isAccessError,
    error: accessError,
  } = useProjectAccessQuery(projectId);

  if (isProjectError) throw projectError;
  if (isAccessError) throw accessError;

  // Show loading screen if still loading
  if (isProjectLoading || isAccessLoading || !project || !access) {
    return <LoadingScreen />;
  }

  GlobalStoreInst.set('activeProject', project);

  const isReadOnly = access.projectPermission === 'VIEW';
  const viewOnlyMessage = getViewOnlyMessage(t);

  // Check project limit for free users
  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;
  const isProjectLimitLocked =
    isLimitReached && userProfile?.subscriptionTier === SubscriptionTier.FREE;

  let activeDocType = [...project.buildables]
    .sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    )
    .reduce((buildable, cur) => {
      if (cur.status === IssueStatus.COMPLETED) {
        if (cur.name === DOCTYPE.DEVELOPMENT_PLAN) {
          buildable = DOCTYPE.DEVELOPMENT_PLAN;
        } else if (cur.name === DOCTYPE.PROTOTYPE) {
          buildable = DOCTYPE.PROTOTYPE;
        } else if (cur.name === DOCTYPE.PRD) {
          buildable = DOCTYPE.PRD;
        }
      }
      return buildable;
    }, '');
  const isJIRASyncLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string
  );

  const meta = (project?.meta as Prisma.JsonObject) ?? {};
  let jiraInfo = meta?.jira ? (meta.jira as JiraEntity) : null;

  const handleSyncToJira = async () => {
    setSyncButtonEnabled(false);
    setSyncError(false);
    try {
      await createJiraProject({
        name: project.name,
        id: project.id,
        jira_key: jiraInfo?.key || '',
      });
      // track event
      trackEvent('syncToJira', {
        distinct_id: user.email,
        payload: JSON.stringify({
          projectName: project.name,
        }),
      });
      // Refresh project data to get updated jiraInfo
      window.location.reload();
    } catch (error) {
      setSyncError(true);
      setSyncButtonEnabled(true);
      console.error('Error syncing project to Jira', error);
    }
  };

  const renderSyncToJiraButton = () => {
    if (isJIRASyncLocked) {
      return (
        <Tooltip title={t('common.upgradeToPerformance')}>
          <Button
            type="link"
            icon={<InfoCircleOutlined style={{ color: 'orange' }} />}
            onClick={() => {
              showAppModal({
                type: 'updateSubscription',
                payload: {
                  email: user.email,
                  source: 'projectBuildingSyncToJira',
                  destination: 'JiraSync',
                },
              });
            }}
            disabled={isReadOnly}
          >
            Jira
          </Button>
        </Tooltip>
      );
    }

    if (syncError) {
      return (
        <Tooltip title={t('building.error')}>
          <Button
            type="link"
            icon={<InfoCircleOutlined style={{ color: 'red' }} />}
            disabled
          >
            {t('building.error')}
          </Button>
        </Tooltip>
      );
    }

    if (syncButtonEnabled && !jiraInfo) {
      return (
        <Tooltip title={t('building.syncProjectToJira')}>
          <Button
            type="link"
            icon={<SyncOutlined style={{ color: COLORS.PRIMARY }} />}
            onClick={handleSyncToJira}
            disabled={isReadOnly}
          >
            Jira
          </Button>
        </Tooltip>
      );
    }

    if (jiraInfo) {
      return (
        <Tooltip title={t('building.projectSyncedToJira')}>
          <Button
            type="text"
            icon={<CheckOutlined style={{ color: COLORS.PRIMARY }} />}
            disabled
          >
            {t('building.synced')}
          </Button>
        </Tooltip>
      );
    }

    return null;
  };

  let toggles = (
    <Space>
      <Radio.Group
        disabled={isLocked}
        onChange={(e) => {
          if (isLocked && e.target.value === 'kanban') {
            showAppModal({
              type: 'updateSubscription',
              payload: {
                email: user.email,
                source: 'builderWorkPlanMode',
                destination: 'ScrumToggleKanban',
              },
            });
          } else {
            setBoardMode(e.target.value);
            // track event
            trackEvent('toggleKanbanScrum', {
              distinct_id: user.email,
              payload: JSON.stringify({
                project: project.name,
                mode: e.target.value,
              }),
            });
          }
        }}
        defaultValue={boardMode}
      >
        <Radio.Button value="sprint">{t('project.scrum')}</Radio.Button>
        <Radio.Button value="kanban">
          {isLocked && (
            <Tooltip title={t('common.upgradeToPerformance')}>
              <InfoCircleOutlined style={{ color: 'orange' }} />
            </Tooltip>
          )}
          &nbsp; {t('project.kanban')}
        </Radio.Button>
        {/* <Radio.Button value="milestone">Milestone</Radio.Button> */}
      </Radio.Group>
      {renderSyncToJiraButton()}
    </Space>
  );

  const breadcrumbItems = [
    {
      key: 'orgs',
      link: `/org`,
      label: t('project.projects'),
    },
    {
      key: project.id,
      link:
        access.projectPermission === 'VIEW' ? '' : `/projects/${project.id}`,
      label:
        access.projectPermission === 'VIEW' ? (
          <>
            {project.name} <Tag>{t('project.view')}</Tag>
          </>
        ) : (
          project.name
        ),
    },
  ];

  const handleCustomizeWorkflow = () => {
    showAppModal({
      type: 'editWorkflow',
      project,
    });
  };

  const customizeButton = (
    <Tooltip title={isReadOnly ? viewOnlyMessage : t('project.customize')}>
      <Button
        type="link"
        style={{ padding: 0, color: 'black', opacity: isReadOnly ? 0.5 : 1 }}
        icon={
          <ApartmentOutlined style={{ color: COLORS.PRIMARY, fontSize: 18 }} />
        }
        onClick={handleCustomizeWorkflow}
        disabled={isReadOnly}
      >
        customize
      </Button>
    </Tooltip>
  );

  return (
    <Flex className="page-container" vertical>
      <Flex
        className="document-toolbar"
        align="center"
        justify="space-between"
        style={{ marginBottom: '0.5em', width: '100%' }}
      >
        {/* left：Breadcrumb +  ProjectStep */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AppBreadcrumb items={breadcrumbItems} />
        </div>

        {/* Right: Dropdown Menu */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ProjectDropdownMenu project={project} access={access} />
        </div>
      </Flex>
      <Tabs
        id="project-tabs"
        className="project-nav"
        onChange={onTabChange}
        activeKey={activeKey}
        type="card"
        items={tabItems}
        tabBarExtraContent={
          <Space>
            {activeKey !== BuildingPath && customizeButton}
            {activeKey === BuildingPath && toggles}
          </Space>
        }
      />
      <Outlet
        context={
          {
            project,
            filterMode: boardMode,
            access: access,
          } satisfies ContextType
        }
      />
    </Flex>
  );
}

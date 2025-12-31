import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { Project, SubscriptionTier } from '@prisma/client';
import { Dropdown, Flex, message, Modal, Space, Typography } from 'antd';

import { ProjectOutput } from '../../../../../shared/types';
import { useAppModal } from '../../../common/components/AppModal';
import { FREE_PROJECT_LIMIT } from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { cloneProjectApi } from '../../project/api/project';

import './DropdownOperMenu.scss';

type WithKey = Readonly<{ key: string }>;

interface ProjectDropdownMenuProps {
  isShowDots?: boolean;
  menuItemKey: string;
  project: Project;
  onMenuItemClicked: ({ key }: WithKey) => void;
}

enum DropdownOption {
  EDIT_PROJECT = 'EDIT_PROJECT',
  CLONE_PROJECT = 'CLONE_PROJECT',
  DELETE_PROJECT = 'DELETE_PROJECT',
}

export function ProjectDropdownOperMenu({
  isShowDots,
  menuItemKey,
  project,
  onMenuItemClicked,
}: ProjectDropdownMenuProps) {
  const { showAppModal } = useAppModal();
  const { user, isAdmin } = useCurrentUser();
  const { t } = useLanguage();
  const { data: userProfile } = useUserProfileQuery(user.id);
  const { data: organization } = useOrganizationHierarchy();

  // Check project limit for free users
  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;
  const isFeatureLocked =
    isLimitReached && userProfile?.subscriptionTier === SubscriptionTier.FREE;

  const items = [
    {
      label: t('layout.editProject'),
      key: DropdownOption.EDIT_PROJECT,
      icon: <EditOutlined />,
    },
    {
      label: t('layout.cloneProject'),
      key: DropdownOption.CLONE_PROJECT,
      icon: <CopyOutlined />,
    },
    {
      label: t('layout.deleteProject'),
      key: DropdownOption.DELETE_PROJECT,
      icon: <DeleteOutlined />,
    },
  ];

  function clickEditProject(e: React.MouseEvent) {
    console.log(
      `containers.project.components.projectdropdownmenu.clickEditProject, projectId: ${project.id}`
    );
    showAppModal({
      type: 'editProject',
      project: {
        ...project,
      } as ProjectOutput,
    });
  }

  function clickDeleteProject(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log(
      `containers.project.components.projectdropdownmenu.clickDeleteProject, projectId: ${project.id}`
    );
    showAppModal({ type: 'deleteProject', projectId: project.id });
  }

  function clickCloneProject(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log('Clone project', project.id);

    // Check if user has reached project limit
    if (isFeatureLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'projectCloneLimit',
          destination: 'newPlan',
          isLowCredits: false,
        },
      });
      return;
    }

    Modal.confirm({
      title: t('layout.cloneProject'),
      content: t('layout.cloneProjectConfirm').replace(
        '{projectName}',
        project.name
      ),
      okText: t('layout.cloneProject'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const clonedProject = await cloneProjectApi(project.id);
          message.success(
            `Project "${project.name}" has been cloned successfully as "${clonedProject.name}"`,
            2000
          );
          
          // Redirect to the builder page
          setTimeout(() => {
            window.location.href = `/projects/${clonedProject.id}/planning/builder`;
          }, 2000);
        } catch (error) {
          console.error('Error cloning project:', error);
          Modal.error({
            title: 'Error',
            content: 'Failed to clone project. Please try again.',
          });
        }
      },
    });
  }

  const itemClickHandlers = new Map<string, any>();
  itemClickHandlers.set('EDIT_PROJECT', clickEditProject);
  itemClickHandlers.set('CLONE_PROJECT', clickCloneProject);
  itemClickHandlers.set('DELETE_PROJECT', clickDeleteProject);

  function handleMenuClick(e: { key: string }) {
    itemClickHandlers.get(e.key)();
  }

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  if (isShowDots) {
    return project.ownerUserId === user?.id || isAdmin ? (
      <Dropdown
        menu={menuProps}
        trigger={['click']}
        className="project-dropdown-operation"
      >
        <div
          style={{
            fontSize: '20px',
            textAlign: 'center',
            position: 'relative',
            top: '-5px',
          }}
        >
          ...
        </div>
      </Dropdown>
    ) : (
      <></>
    );
  }

  return (
    <Flex justify="space-between" align="center" className="dropdown-container">
      <Typography.Text
        onClick={() => onMenuItemClicked({ key: menuItemKey })}
        ellipsis
        style={{ maxWidth: '125px' }}
      >
        {project.name}
      </Typography.Text>

      {(project.ownerUserId === user?.id || isAdmin) && (
        <Space className="dropdown-operation">
          <Dropdown
            menu={menuProps}
            trigger={['click']}
            className="dropdown-operation"
          >
            <EllipsisOutlined
              style={{
                display: 'inline',
                fontSize: '16px',
                color: '#6d8383',
                paddingTop: '0.1em',
                verticalAlign: 'middle',
              }}
            />
          </Dropdown>
        </Space>
      )}
    </Flex>
  );
}

import React from 'react';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { SubscriptionTier } from '@prisma/client';
import { Button, Dropdown, Flex, message, Modal, Tooltip } from 'antd';

import {
  ProjectAccessResponse,
  ProjectOutput,
} from '../../../../../shared/types';
import { useAppModal } from '../../../common/components/AppModal';
import {
  FREE_PROJECT_LIMIT,
  getViewOnlyMessage,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { COLORS } from '../../../lib/constants';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { cloneProjectApi } from '../api/project';

type ProjectDropdownMenuProps = Readonly<{
  project: ProjectOutput;
  access: ProjectAccessResponse;
}>;

export default function ProjectDropdownMenu({
  project,
  access,
}: ProjectDropdownMenuProps) {
  const { showAppModal } = useAppModal();
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { data: userProfile } = useUserProfileQuery(user.id);
  const { data: organization } = useOrganizationHierarchy();

  const { id } = project;

  const isReadOnly = access.projectPermission === 'VIEW';
  const viewOnlyMessage = getViewOnlyMessage(t);

  // Check project limit for free users
  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;
  const isFeatureLocked =
    isLimitReached && userProfile?.subscriptionTier === SubscriptionTier.FREE;

  function clickEditProject(e: React.MouseEvent) {
    console.log(
      `containers.project.components.projectdropdownmenu.clickEditProject, projectId: ${id}`
    );
    showAppModal({ type: 'editProject', project: project });
  }

  function clickDeleteProject(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log(
      `containers.project.components.projectdropdownmenu.clickDeleteProject, projectId: ${id}`
    );
    showAppModal({ type: 'deleteProject', projectId: id });
  }

  function clickShareProject(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log('Share project', id);
    showAppModal({
      type: 'shareProject',
      projectId: id,
      title: project.name,
      projectAccess: project.access,
    });
  }

  function clickCloneProject(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log('Clone project', id);

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
      title: t('project.cloneConfirmTitle'),
      content: t('project.cloneConfirmContent').replace('{name}', project.name),
      okText: t('project.clone'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const clonedProject = await cloneProjectApi(id);
          message.success(
            t('project.cloneSuccess')
              .replace('{name}', project.name)
              .replace('{clonedName}', clonedProject.name),
            2000
          );
          
          // Redirect to the builder page
          setTimeout(() => {
            window.location.href = `/projects/${clonedProject.id}/planning/builder`;
          }, 2000);
        } catch (error) {
          console.error('Error cloning project:', error);
          Modal.error({
            title: t('common.error'),
            content: t('project.cloneError'),
          });
        }
      },
    });
  }

  const settingsMenuItems = [
    {
      key: 'edit',
      label: t('project.edit'),
      icon: <EditOutlined />,
      onClick: () => clickEditProject({} as React.MouseEvent),
      disabled: isReadOnly,
    },
    {
      key: 'delete',
      label: t('project.delete'),
      icon: <DeleteOutlined />,
      onClick: () => clickDeleteProject(),
      disabled: isReadOnly,
    },
  ];

  return (
    <Flex align="center" gap={12} style={{ opacity: 1.0 }}>
      <Tooltip title={isReadOnly ? viewOnlyMessage : t('project.cloneProject')}>
        <Button
          type="link"
          style={{ padding: 0, color: 'black', opacity: isReadOnly ? 0.5 : 1 }}
          icon={
            <CopyOutlined style={{ color: COLORS.PRIMARY, fontSize: 18 }} />
          }
          onClick={clickCloneProject}
          disabled={isReadOnly}
        />
      </Tooltip>
      <Tooltip
        title={isReadOnly ? viewOnlyMessage : t('project.projectSettings')}
      >
        <Dropdown
          menu={{ items: settingsMenuItems }}
          placement="bottomRight"
          trigger={['click']}
          disabled={isReadOnly}
        >
          <Button
            type="text"
            icon={
              <SettingOutlined
                style={{ color: COLORS.PRIMARY, fontSize: 16 }}
              />
            }
            style={{
              color: COLORS.PRIMARY,
              fontSize: '16px',
            }}
          />
        </Dropdown>
      </Tooltip>
      <Tooltip title={isReadOnly ? viewOnlyMessage : t('project.shareProject')}>
        <Button
          type="primary"
          style={{ opacity: isReadOnly ? 0.5 : 1 }}
          icon={<ShareAltOutlined />}
          onClick={clickShareProject}
          disabled={isReadOnly}
        >
          {t('project.share')}
        </Button>
      </Tooltip>
    </Flex>
  );
}

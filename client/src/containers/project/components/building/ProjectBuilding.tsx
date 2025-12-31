// create a react component that display a line of text "Project Execution - {projectId}"

import { Flex } from 'antd';
import { Outlet, redirect, useLocation } from 'react-router';

import ActionGroup, {
  ActionGroupItem,
} from '../../../../common/components/ActionGroup';
import { useAppModal } from '../../../../common/components/AppModal';
import SecondaryMenu, {
  SecondaryMenuItem,
} from '../../../../common/components/SecondaryMenu';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import {
  IssueBoardPath,
  MilestonesPath,
  ProjectOrganizationPath,
} from '../../../nav/paths';
import { useProject } from '../Project';

function getMenuItems(
  t: (key: string) => string
): ReadonlyArray<SecondaryMenuItem> {
  return [
    {
      key: MilestonesPath,
      label: t('building.milestones'),
      link: MilestonesPath,
    },
    {
      key: ProjectOrganizationPath,
      label: t('building.workPlan'),
      link: ProjectOrganizationPath,
    },
    {
      key: IssueBoardPath,
      label: t('building.taskBoard'),
      link: IssueBoardPath,
    },
  ];
}

function useActiveMenuKey(menuItems: ReadonlyArray<SecondaryMenuItem>): string {
  const location = useLocation();
  const pathComponents = location.pathname.split('/');
  // Note: the pathname starts with a / so the first pathComponent will be empty
  return pathComponents.length >= 5 ? pathComponents[4] : menuItems[0].key;
}

export function ProjectBuildingIndex() {
  return redirect(MilestonesPath);
}

export function ProjectBuilding() {
  const { showAppModal } = useAppModal();
  const { project, filterMode, access } = useProject();
  const isReadOnly = access.projectPermission === 'VIEW';
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const menuItems = getMenuItems(t);
  const activeKey = useActiveMenuKey(menuItems);

  const actionItems: ReadonlyArray<ActionGroupItem> = [
    // {
    //   key: 'addIssue',
    //   label: t('project.addIssue'),
    //   render: () => (
    //     <Tooltip title={t('project.addIssueTooltip')} key="addIssueTooltip">
    //       <Button
    //         type="link"
    //         icon={<PlusCircleOutlined />}
    //         size={'middle'}
    //         onClick={() => {
    //           showAppModal({ type: 'addIssue' });
    //         }}
    //         disabled={isReadOnly}
    //       >
    //         {t('project.addIssue')}
    //       </Button>
    //     </Tooltip>
    //   ),
    //   handler: () => {
    //     showAppModal({ type: 'addIssue' });
    //   },
    // },
  ];

  return (
    <>
      {/* <Flex
        style={{
          marginBottom: '16px',
          columnGap: '10px',
          rowGap: '6px',
        }}
      >
        <SecondaryMenu items={menuItems} activeKey={activeKey} />
        <ActionGroup items={actionItems} />
      </Flex> */}
      <Outlet context={{ project, filterMode, access }} />
    </>
  );
}

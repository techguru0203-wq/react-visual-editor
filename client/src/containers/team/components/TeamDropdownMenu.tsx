import React from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { ProjectStatus, RecordStatus } from '@prisma/client';
import { Dropdown } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { TeamOutput } from '../types/teamTypes';

enum DropdownOption {
  EDIT_TEAM = 'EDIT_TEAM',
  DELETE_TEAM = 'DELETE_TEAM',
  ADD_SUB_TEAM = 'ADD_SUB_TEAM',
}

type TeamDropDownMenuProps = Readonly<{
  team: TeamOutput;
}>;

function isUserInTeam(userId: string, team: TeamOutput): Boolean {
  return !!team.members.find((member) => member.user.id === userId);
}

function isTeamDeletable(team: TeamOutput): Boolean {
  const hasUncanceledProject = !!team.projects.find(
    (proj) => proj.status !== ProjectStatus.CANCELED
  );
  if (hasUncanceledProject) return false;

  return !team.childTeams.find(
    (childTeam) => childTeam.status !== RecordStatus.DEACTIVATED
  );
}

export default function TeamDropDownMenu({ team }: TeamDropDownMenuProps) {
  const { showAppModal } = useAppModal();
  const { user } = useCurrentUser();
  const { id } = team;

  if (!isUserInTeam(user.id, team)) {
    return null;
  }

  function clickEditTeam(e: React.MouseEvent) {
    console.log(
      `containers.project.components.teamdropdownmenu.clickEditTeam, teamId: ${id}`
    );
    showAppModal({ type: 'editTeam', team: team });
  }

  function clickDeleteTeam(e?: React.MouseEvent<Element, MouseEvent>) {
    console.log(
      `containers.project.components.teamdropdownmenu.clickDeleteTeam, teamId: ${id}`
    );
    if (isTeamDeletable(team)) {
      showAppModal({ type: 'deleteTeam', teamId: id });
    } else {
      showAppModal({
        type: 'deleteTeamInvalid',
        message:
          'A team can be deleted only if it has no sub-teams and no active projects.',
      });
    }
  }

  function clickAddSubTeam() {
    showAppModal({ type: 'addTeam', parentTeamid: id });
  }

  const items = [
    {
      label: 'Edit Team',
      key: DropdownOption.EDIT_TEAM,
      icon: <EditOutlined />,
    },
    {
      label: 'Add Sub-team',
      key: DropdownOption.DELETE_TEAM,
      icon: <UsergroupAddOutlined />,
    },
    {
      label: 'Delete Team',
      key: DropdownOption.DELETE_TEAM,
      icon: <DeleteOutlined />,
    },
  ];

  const itemClickHandlers = new Map<string, any>();
  itemClickHandlers.set('EDIT_TEAM', clickEditTeam);
  itemClickHandlers.set('DELETE_TEAM', clickDeleteTeam);
  itemClickHandlers.set('ADD_SUB_TEAM', clickAddSubTeam);

  function handleMenuClick(e: { key: string }) {
    itemClickHandlers.get(e.key)();
  }

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  return (
    <Dropdown menu={menuProps} trigger={['click']}>
      <EllipsisOutlined
        style={{
          display: 'inline',
          fontSize: '28px',
          color: '#6d8383',
          paddingTop: '0.2em',
          verticalAlign: 'bottom',
        }}
      />
    </Dropdown>
  );
}

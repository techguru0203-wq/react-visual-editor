import { useCallback } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Flex, Space, Typography } from 'antd';
import { signOut } from 'aws-amplify/auth';
import { useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { UserAvatar } from '../../../common/components/UserAvatar';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as LogoIcon } from '../../../common/icons/logo.svg';
import { ReactComponent as ProjectIcon } from '../../../common/icons/project-icon.svg';
// import { ReactComponent as TeamsIconBlue } from '../../../common/icons/teams-icon-blue.svg';
import { COLORS } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import {
  BillingPath,
  HomePath,
  JiraAdminPath,
  ProfilePath,
  SettingsPath,
  UsersAdminPath,
  UserTemplateDocumentsPath,
} from '../../nav/paths';
import { useOrganization } from '../../organization/hooks/useOrganization';

enum AddNewOptions {
  NEW_PROJECT = 'NEW_PROJECT',
  NEW_DOCUMENT = 'DELETE_DOCUMENT',
  NEW_TEAM = 'NEW_TEAM',
}

export default function TopNavBar() {
  const { user, hasProfile, isAdmin } = useCurrentUser();
  const { t } = useLanguage();
  const { data: organization, isError, error } = useOrganization();
  const navigate = useNavigate();
  const { showAppModal } = useAppModal();
  const queryClient = useQueryClient();

  const onClick = useCallback(
    async ({ key }: { key: string }) => {
      // track event
      trackEvent('User Dropdown Click', {
        distinct_id: user.email,
        payload: JSON.stringify({
          key: key,
        }),
      });
      if (key === 'settings') {
        navigate(SettingsPath);
      } else if (key === 'profile') {
        navigate(ProfilePath);
      } else if (key === 'billing') {
        navigate(BillingPath);
      } else if (key === 'jiraAdmin') {
        navigate(JiraAdminPath);
      } else if (key === 'usersAdmin') {
        navigate(UsersAdminPath);
      } else if (key === UserTemplateDocumentsPath) {
        navigate(UserTemplateDocumentsPath);
      } else if (key === 'logout') {
        await signOut();
        queryClient.clear();
      }
    },
    [navigate, queryClient, user.email]
  );

  if (isError) {
    throw error;
  }

  const onClickNew = (e: { key: string }) => {
    if (e.key === AddNewOptions.NEW_PROJECT) {
      // showAppModal({ type: 'addProject' });
      navigate(HomePath);
    } else if (e.key === AddNewOptions.NEW_DOCUMENT) {
      showAppModal({ type: 'addDocument' });
    } else {
      showAppModal({ type: 'addTeam' });
    }
  };

  const iconStyle = { width: '20px', height: '20px', color: COLORS.PRIMARY };
  const addNewItems: MenuProps['items'] = [
    {
      key: AddNewOptions.NEW_PROJECT,
      label: t('button.newProject'),
      icon: <ProjectIcon style={iconStyle} />,
    },
    // {
    //   key: AddNewOptions.NEW_DOCUMENT,
    //   label: 'New Document',
    //   icon: <DocumentIcon style={iconStyle} />,
    // },
    // {
    //   key: AddNewOptions.NEW_TEAM,
    //   label: 'New Team',
    //   icon: <TeamsIconBlue style={iconStyle} />,
    // },
  ];

  const items: MenuProps['items'] = isAdmin
    ? [
        {
          key: ProfilePath,
          label: 'My Profile',
        },
        {
          key: BillingPath,
          label: 'Billing',
        },
        {
          key: SettingsPath,
          label: 'Admin',
        },
      ]
    : [
        {
          key: ProfilePath,
          label: 'My Profile',
        },
      ];
  items.push(
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Log out',
    }
  );
  const { Text } = Typography;
  return hasProfile ? (
    <Flex style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
      <Dropdown
        menu={{ items: addNewItems, onClick: onClickNew }}
        trigger={['click']}
        className="document-dropdown-operation"
      >
        <Button
          id="add-project-btn"
          type="primary"
          icon={<PlusOutlined />}
          size={'middle'}
          style={{ marginRight: '10px' }}
        >
          Add New
        </Button>
      </Dropdown>
      <Dropdown
        className="action-menu"
        menu={{ items, onClick }}
        placement="topRight"
        trigger={['click']}
        arrow
        overlayStyle={{ width: 150 }}
      >
        <Space>
          <UserAvatar user={user} />
        </Space>
      </Dropdown>
    </Flex>
  ) : (
    <Flex style={{ alignItems: 'center', justifyContent: 'flex-start' }}>
      <LogoIcon
        style={{ width: '30px', height: '30px', marginRight: '10px' }}
      />
      <Text className="organization">{organization?.name || 'Omniflow'}</Text>
    </Flex>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { Project, SubscriptionTier } from '@prisma/client';
import { Button, MenuProps, message, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import { Link } from 'react-router-dom';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as ProjectIcon } from '../../../common/icons/project-icon.svg';
import { ReactComponent as TeamsIcon } from '../../../common/icons/teams-icon.svg';
import { COLORS } from '../../../lib/constants';
import {
  DocumentsPath,
  KnowledgeBasePath,
  OrganizationPath,
  ProjectsPath,
  TeamPath,
  TemplateDocumentPath,
} from '../../nav/paths';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import {
  OrganizationHierarchy,
  TeamHierarchy,
} from '../../organization/types/organizationTypes';
import { ProjectDropdownOperMenu } from '../components/ProjectDropdownOperMenu';

type MenuItem = Readonly<Required<MenuProps>['items'][number]>;

type MenuItemAndSelectionInfo = Readonly<{
  menuItem: MenuItem;
  openKeys: string[]; // The keys of every open item from this menu item down
  selectedKeys: string[]; // The keys of every selected item from this menu item down
}>;

type WithKey = Readonly<{ key: string }>;

type NavigationMenuItems = Readonly<{
  normalMenuItems: MenuItem[];
  openItemKeys: string[];
  selectedItemKeys: string[];
  organization: OrganizationHierarchy;
}>;

const iconStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  color: COLORS.ICON_GRAY,
};

const subMenuIconStyle = { ...iconStyle, height: '16px', width: '16px' };

// The key for a menu item should always be the URL to that menu item from root (i.e. /projects/xyz)
export function useNormalNavigationMenuItems(): NavigationMenuItems {
  const location = useLocation();
  const navigate = useNavigate();
  const { showAppModal } = useAppModal();
  const { user, subscriptionTier } = useCurrentUser();
  const { t, language } = useLanguage();
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Check if user has access to Knowledge Base (requires PRO tier or above)
  const canAccessKnowledgeBase =
    subscriptionTier === SubscriptionTier.PRO ||
    subscriptionTier === SubscriptionTier.BUSINESS ||
    subscriptionTier === SubscriptionTier.ENTERPRISE;

  const { data: organization, isError, error } = useOrganizationHierarchy();

  const [selectedKey, setSelectedKey] = useState(location.pathname?.slice(1));
  useEffect(() => {
    setSelectedKey(location.pathname?.slice(1));
  }, [location.pathname]);

  // When a menuItem is clicked, we check if we are already navigated to its key, and if not we navigate
  // We cannot just render Links for the menu items because the grouping menu items need to be able to expand or collapse if we don't navigate here.
  const onMenuItemClicked = useCallback(
    ({ key }: WithKey) => {
      console.log('onMenuItemClicked:', key, location.pathname);
      if (key === 'invite') {
        if ((organization?.availableSeats ?? 0) <= 0) {
          message.warning(
            <span>
              {t('layout.maxSeatsReached')}{' '}
              <Button
                style={{ padding: 5 }}
                type="link"
                onClick={() => {
                  showAppModal({
                    type: 'updateSubscription',
                    payload: {
                      email: user.email,
                      source: 'navBarInviteTeam',
                      destination: 'inviteTeam',
                    },
                  });
                  return false;
                }}
              >
                {t('layout.upgradeAccount')}
              </Button>{' '}
              {t('layout.toAddMoreSeats')}
            </span>
          );
          return;
        }
        // show add teammate popup
        showAppModal({ type: 'addTeamMember', teamId: '' });
      } else if (key === 'feedback') {
        window.open('https://forms.gle/LEhbn91DYYZsQszeA', '_blank');
      } else if (key === `/${KnowledgeBasePath}`) {
        // Check if user has access to Knowledge Base
        if (!canAccessKnowledgeBase) {
          showAppModal({
            type: 'updateSubscription',
            payload: {
              email: user.email,
              source: 'navBarKnowledgeBase',
              destination: 'knowledgeBase',
            },
          });
          return;
        }
        if (location.pathname !== key) {
          navigate(key);
        }
      } else if (location.pathname !== key) {
        navigate(key);
      }
    },
    [
      location.pathname,
      navigate,
      showAppModal,
      organization?.availableSeats,
      user.email,
      t,
      canAccessKnowledgeBase,
    ]
  );

  // Helper function to return a menu item for a project.
  // Returns information about whether the project should be marked as currently selected as well
  const menuItemForProject = useCallback(
    (project: Project): MenuItemAndSelectionInfo => {
      const key = `/${ProjectsPath}/${project.id}`;
      return {
        menuItem: {
          key,
          label: (
            <ProjectDropdownOperMenu
              project={project}
              menuItemKey={key}
              onMenuItemClicked={() => {
                onMenuItemClicked({ key });
              }}
            />
          ),
          icon: <ProjectIcon style={subMenuIconStyle} />,
        },
        openKeys: [], // Projects cannot be expanded in the menu
        selectedKeys: location.pathname.startsWith(key) ? [key] : [],
      };
    },
    [location.pathname, onMenuItemClicked]
  );

  // Helper function to return a menu item for a team.
  // Returns the team menu item and recursively all teams below it, along with their projects
  // For each team, it includes a list of all the selected menu items and open menu items at that team or below in the hierarchy
  const menuItemForTeam = useCallback(
    (team: TeamHierarchy): MenuItemAndSelectionInfo => {
      const key = `/${TeamPath}/${team.id}`;
      const childInfo = [
        ...team.projects.map(menuItemForProject),
        ...team.teams.map(menuItemForTeam),
      ];

      // Combine the openKeys and selectedKeys and menuItems from all our children
      const openKeys = childInfo.map((child) => child.openKeys).flat();
      const selectedKeys = childInfo.map((child) => child.selectedKeys).flat();

      if (location.pathname.startsWith(key)) {
        selectedKeys.unshift(key); // If we are directly selected, add ourselves at the beginning of the selected list
      }
      if (openKeys.length || selectedKeys.length) {
        openKeys.unshift(key); // If any of our children are open, or are selected, we are open.
      }

      return {
        menuItem: {
          key,
          label: <Link to={`/${TeamPath}/${team.id}`}>{team.name}</Link>,
          icon: <TeamsIcon style={subMenuIconStyle} />,
          // children: children?.length ? children : undefined,
        },
        openKeys,
        selectedKeys,
      };
    },
    [location.pathname, menuItemForProject]
  );

  if (isError) {
    throw error;
  }

  const normalMenuItems: MenuItem[] = [];
  const openItemKeys: string[] = [];
  const selectedItemKeys: string[] = [];

  // if (hasProfile) {
  //   const key = `/${HomePath}`;
  //   normalMenuItems.push({
  //     key,
  //     label: 'Home',
  //     icon: <HomeIcon style={iconStyle} />,
  //     onClick: onMenuItemClicked,
  //   });
  //   if (location.pathname.startsWith(key)) {
  //     selectedItemKeys.push(key);
  //   }
  // }

  if (organization) {
    const key = `/${OrganizationPath}`;
    openItemKeys.push(key); // Always keep the organization item open
    if (location.pathname.startsWith(key)) {
      selectedItemKeys.push(key);
    }

    // Sort projects by updatedAt (most recent first)
    const sortedProjects = [...organization.projects].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    // Check if current selected project is in the first 5
    const currentProjectId = location.pathname.split('/')[2]; // Extract project ID from path like /projects/{id}
    const currentProjectIndex = sortedProjects.findIndex(
      (p) => p.id === currentProjectId
    );
    const shouldShowAll =
      showAllProjects || (currentProjectIndex >= 0 && currentProjectIndex >= 5);

    // Show only first 5 projects by default, or all if "More" is clicked or current project is beyond first 5
    const displayedProjects = shouldShowAll
      ? sortedProjects
      : sortedProjects.slice(0, 5);
    const hasMoreProjects = sortedProjects.length > 5;

    const projectsInfo = displayedProjects.map(menuItemForProject);

    // const teamsInfo = [...organization.teams.map(menuItemForTeam)];

    selectedItemKeys.push(
      ...projectsInfo.map((child) => child.selectedKeys).flat()
      // ...teamsInfo.map((child) => child.selectedKeys).flat()
    );
    openItemKeys.push(...projectsInfo.map((child) => child.openKeys).flat());
    // openItemKeys.push(...teamsInfo.map((child) => child.openKeys).flat());

    // Build children array with projects and optional "More" button
    const projectChildren = projectsInfo.map((c) => c.menuItem);
    if (hasMoreProjects && !shouldShowAll) {
      projectChildren.push({
        key: 'show-more-projects',
        label: (
          <Button
            type="link"
            style={{
              padding: 0,
              height: 'auto',
              fontSize: '14px',
              color: COLORS.PRIMARY,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowAllProjects(true);
            }}
          >
            {t('common.more')}
          </Button>
        ),
        icon: null,
      });
    }

    normalMenuItems.push(
      {
        key: OrganizationPath,
        label: t('nav.myProjects'),
        icon: <AppstoreOutlined style={iconStyle} />,
        className:
          selectedKey === OrganizationPath ? 'root-menu-selected' : undefined,
        onTitleClick: onMenuItemClicked,
        // onClick: onMenuItemClicked,
        children: projectChildren,
      },
      // {
      //   type: 'divider',
      // },
      // {
      //   key: `/${DashboardPath}`,
      //   label: t('nav.dashboard'),
      //   icon: <TaskIcon style={iconStyle} />,
      //   className:
      //     selectedKey === DashboardPath ? 'root-menu-selected' : undefined,
      //   onClick: onMenuItemClicked,
      // },
      {
        key: `/${KnowledgeBasePath}`,
        label: (
          <Tooltip
            title={
              canAccessKnowledgeBase
                ? t('nav.knowledgeBase')
                : t('nav.upgradePlanToAccessKnowledgeBase')
            }
          >
            <span
              style={{
                color: canAccessKnowledgeBase ? undefined : '#ccc',
                cursor: 'pointer',
              }}
            >
              {t('nav.knowledgeBase')}
            </span>
          </Tooltip>
        ),
        icon: (
          <DatabaseOutlined
            style={{
              ...iconStyle,
              color: canAccessKnowledgeBase ? iconStyle.color : '#ccc',
            }}
          />
        ),
        className:
          selectedKey === KnowledgeBasePath ? 'root-menu-selected' : undefined,
        onClick: onMenuItemClicked,
      },
      // {
      //   key: `/${IdeasPath}`,
      //   label: 'Ideas',
      //   className: selectedKey === IdeasPath ? 'root-menu-selected' : undefined,
      //   icon: <ChatIcon style={iconStyle} />,
      //   onClick: onMenuItemClicked,
      // },
      // {
      //   key: DocumentsPath,
      //   label: 'PRDs',
      //   icon: <ChatIcon style={iconStyle} />,
      //   className:
      //     selectedKey === DocumentsPath ? 'root-menu-selected' : undefined,
      //   onClick: onMenuItemClicked,
      // },
      // {
      //   key: AppsPath,
      //   label: 'Prototypes',
      //   icon: <DocumentIcon style={iconStyle} />,
      //   className: selectedKey === AppsPath ? 'root-menu-selected' : undefined,
      //   onClick: onMenuItemClicked,
      // },

      // Only show templates tab for English users
      ...(language === 'en'
        ? [
            {
              key: `/${TemplateDocumentPath}`,
              label: t('nav.templates'),
              icon: <FileTextOutlined style={iconStyle} />,
              className:
                selectedKey === TemplateDocumentPath
                  ? 'root-menu-selected'
                  : undefined,
              onClick: onMenuItemClicked,
            },
          ]
        : []),
      {
        type: 'divider',
      },
      {
        key: `invite`,
        label: t('nav.inviteTeam'),
        icon: <UsergroupAddOutlined style={iconStyle} />,
        className: selectedKey === 'invite' ? 'root-menu-selected' : undefined,
        onClick: onMenuItemClicked,
      }
      // {
      //   key: `TeamsPath`,
      //   label: 'Teams',
      //   icon: <TeamsIcon style={iconStyle} />,
      //   onClick: onMenuItemClicked,
      //   children: teamsInfo.map((c) => c.menuItem),
      // }
    );
    if (location.pathname.startsWith(`/${DocumentsPath}`)) {
      selectedItemKeys.push(`/${DocumentsPath}`);
    }
  }

  return {
    normalMenuItems,
    openItemKeys,
    selectedItemKeys,
    organization: organization as OrganizationHierarchy,
  };
}

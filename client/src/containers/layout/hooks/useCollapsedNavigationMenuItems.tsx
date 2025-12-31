import { useCallback, useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Project, SubscriptionTier } from '@prisma/client';
import { MenuProps, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import { Link } from 'react-router-dom';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as ProjectIcon } from '../../../common/icons/project-icon.svg';
import { COLORS } from '../../../lib/constants';
import {
  KnowledgeBasePath,
  OrganizationPath,
  ProjectsPath,
  TeamPath,
  TemplateDocumentPath,
} from '../../nav/paths';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import { TeamHierarchy } from '../../organization/types/organizationTypes';

type MenuItem = Readonly<Required<MenuProps>['items'][number]>;

type MenuItemAndSelectionInfo = Readonly<{
  menuItem: MenuItem;
  openKeys: string[]; // The keys of every open item from this menu item down
  selectedKeys: string[]; // The keys of every selected item from this menu item down
}>;

type WithKey = Readonly<{ key: string }>;

type NavigationMenuItems = Readonly<{
  collapsedMenuItems: MenuItem[];
}>;

const iconStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  color: COLORS.ICON_GRAY,
};
const subMenuIconStyle = { ...iconStyle, height: '16px', width: '16px' };

// The key for a menu item should always be the URL to that menu item from root (i.e. /projects/xyz)
export function useCollapsedNavigationMenuItems(): NavigationMenuItems {
  const { subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: organization, isError, error } = useOrganizationHierarchy();

  // Check if user has access to Knowledge Base (requires PRO tier or above)
  const canAccessKnowledgeBase =
    subscriptionTier === SubscriptionTier.PRO ||
    subscriptionTier === SubscriptionTier.BUSINESS ||
    subscriptionTier === SubscriptionTier.ENTERPRISE;

  const [selectedKey, setSelectedKey] = useState(location.pathname?.slice(1));
  useEffect(() => {
    setSelectedKey(location.pathname?.slice(1));
  }, [location.pathname]);

  // When a menuItem is clicked, we check if we are already navigated to its key, and if not we navigate
  // We cannot just render Links for the menu items because the grouping menu items need to be able to expand or collapse if we don't navigate here.
  const onMenuItemClicked = useCallback(
    ({ key }: WithKey) => {
      console.log('onMenuItemClicked:', key, location.pathname);
      if (location.pathname !== key) {
        navigate(key);
      }
    },
    [location.pathname, navigate]
  );

  // Helper function to return a menu item for a project.
  // Returns information about whether the project should be marked as currently selected as well
  const menuItemForProject = useCallback(
    (project: Project): MenuItemAndSelectionInfo => {
      const key = `/${ProjectsPath}/${project.id}`;
      return {
        menuItem: {
          key,
          label: project.name,
          icon: <ProjectIcon style={subMenuIconStyle} />,
          onClick: onMenuItemClicked,
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
      const children = childInfo.map((child) => child.menuItem);
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
          icon: <TeamOutlined />,
          children: children?.length ? children : undefined,
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

  const collapsedMenuItems: MenuItem[] = [];

  // if (hasProfile) {
  //   const key = `/${HomePath}`;
  //   collapsedMenuItems.push({
  //     key,
  //     label: 'Home',
  //     icon: <HomeIcon style={iconStyle} />,
  //     onClick: onMenuItemClicked,
  //   });
  // }

  if (organization) {
    const projectsInfo = [...organization.projects.map(menuItemForProject)];

    const teamsInfo = [...organization.teams.map(menuItemForTeam)];

    collapsedMenuItems.push(
      {
        key: OrganizationPath,
        label: t('nav.myProjects'),
        icon: <AppstoreOutlined style={iconStyle} />,
        className:
          selectedKey === OrganizationPath ? 'root-menu-selected' : undefined,
        onTitleClick: onMenuItemClicked,
        children: projectsInfo.map((c) => c.menuItem),
      },
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
                cursor: canAccessKnowledgeBase ? 'pointer' : 'not-allowed',
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
        onClick: canAccessKnowledgeBase ? onMenuItemClicked : undefined,
      },
      {
        type: 'divider',
      },
      // {
      //   key: `/${DashboardPath}`,
      //   label: 'Dashboard',
      //   icon: <TaskIcon style={iconStyle} />,
      //   className:
      //     selectedKey === DashboardPath ? 'root-menu-selected' : undefined,
      //   onClick: onMenuItemClicked,
      // },
      {
        key: `/${TemplateDocumentPath}`,
        label: 'Templates',
        icon: <FileTextOutlined style={iconStyle} />,
        className:
          selectedKey === TemplateDocumentPath
            ? 'root-menu-selected'
            : undefined,
        onClick: onMenuItemClicked,
      },
      {
        type: 'divider',
      }
      // {
      //   key: `/${DocumentsPath}?q=prd`,
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
      //   label: 'Apps',
      //   icon: <DocumentIcon style={iconStyle} />,
      //   className: selectedKey === AppsPath ? 'root-menu-selected' : undefined,
      //   onClick: onMenuItemClicked,
      // },
      // {
      //   type: 'divider',
      // },
      // {
      //   key: `TeamsPath`,
      //   label: 'Teams',
      //   icon: <TeamsIcon style={iconStyle} />,
      //   onClick: onMenuItemClicked,
      //   children: teamsInfo.map((c) => c.menuItem),
      // }
    );
  }

  return { collapsedMenuItems };
}

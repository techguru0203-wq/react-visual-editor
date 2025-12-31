import { Outlet, redirect, useLocation } from 'react-router';

import SecondaryMenu from '../../../../common/components/SecondaryMenu';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { BuilderPath, InfoPath } from '../../../nav/paths';
import { useProject } from '../Project';

function getMenuItems(t: (key: string) => string) {
  return [
    {
      key: BuilderPath,
      label: t('project.workflow'),
      link: BuilderPath,
    },
    {
      key: InfoPath,
      label: t('project.info'),
      link: InfoPath,
    },
  ];
}

function useActiveMenuKey(menuItems: any[]): string {
  const location = useLocation();
  const pathComponents = location.pathname.split('/');
  // Note: the pathname starts with a / so the first pathComponent will be empty
  return pathComponents.length >= 5 ? pathComponents[4] : menuItems[0].key;
}

export function ProjectPlanningIndex() {
  return redirect(BuilderPath);
}

export function ProjectPlanning() {
  const { project, access } = useProject();

  return (
    <>
      {/* <SecondaryMenu items={menuItems} activeKey={activeKey} /> */}
      {/* <ActionGroup items={actionGroup} /> */}
      <Outlet context={{ project, access }} />
    </>
  );
}

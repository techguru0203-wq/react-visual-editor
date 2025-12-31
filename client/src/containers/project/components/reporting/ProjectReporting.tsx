import { Outlet, redirect, useLocation } from 'react-router';

import SecondaryMenu, {
  SecondaryMenuItem,
} from '../../../../common/components/SecondaryMenu';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { SnapshotPath } from '../../../nav/paths';
import { useProject } from '../Project';

import './ProjectReporting.scss';

function getMenuItems(
  t: (key: string) => string
): ReadonlyArray<SecondaryMenuItem> {
  return [
    {
      key: SnapshotPath,
      label: t('reporting.insights'),
      link: SnapshotPath,
    },
    // {
    //   key: WeeklyPath,
    //   label: 'Weekly Report',
    //   link: WeeklyPath,
    // },
  ];
}

function useActiveMenuKey(menuItems: ReadonlyArray<SecondaryMenuItem>): string {
  const location = useLocation();
  const pathComponents = location.pathname.split('/');
  // Note: the pathname starts with a / so the first pathComponent will be empty
  return pathComponents.length >= 5 ? pathComponents[4] : menuItems[0].key;
}

export function ProjectReportingIndex() {
  return redirect(SnapshotPath);
}

export function ProjectReporting() {
  const { project } = useProject();
  const { t } = useLanguage();
  const menuItems = getMenuItems(t);
  const activeKey = useActiveMenuKey(menuItems);

  return (
    <>
      {/* <SecondaryMenu items={menuItems} activeKey={activeKey} /> */}
      <Outlet context={{ project }} />
    </>
  );
}

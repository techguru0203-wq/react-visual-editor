import { useCallback } from 'react';
import { Breadcrumb } from 'antd';
import Link from 'antd/es/typography/Link';
import { useLocation, useNavigate } from 'react-router-dom';

import trackEvent from '../../trackingClient';
import { useCurrentUser } from '../contexts/currentUserContext';

export interface BreadCrumbItem {
  label: React.ReactNode;
  key: string;
  link?: string;
}

interface ComponentProps {
  items: ReadonlyArray<BreadCrumbItem>;
}

export default function AppBreadcrumb({ items }: ComponentProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const location = useLocation();
  const onItemClick = useCallback(
    (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
      let link = e.currentTarget.getAttribute('href');
      console.log('onItemClick:');
      e.preventDefault();
      if (link) {
        navigate(link as string);
        // track event
        trackEvent('breadcrumbClick', {
          distinct_id: user.email,
          payload: JSON.stringify({
            link: link,
            source: 'breadcrumb',
          }),
        });
      }
    },
    [navigate, user.email]
  );
  const breadcrumbItems: any[] = items.map((item) => {
    const titleNode = item.label;

    return {
      href: item.link,
      title: titleNode,
      onClick: onItemClick,
    };
  });

  return (
    <Breadcrumb
      style={{
        marginBottom: '0px',
        flexGrow: '1',
      }}
      items={breadcrumbItems}
      itemRender={(route, params, routes, paths) => {
        if (location.pathname.includes(route.href as string)) {
          return <span>{route.title}</span>;
        }
        return (
          <Link onClick={() => navigate(route.href as string)}>
            <span style={{ textDecoration: 'underline' }}> {route.title}</span>
          </Link>
        );
      }}
    />
  );
}

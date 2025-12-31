import { Outlet } from 'react-router';

import { ModalProvider } from '../../../common/components/AppModal';

import '../styles/PublicLayout.scss';

export function EmptyLayout() {
  return (
    <div className="app-container--public">
      <ModalProvider>
        <Outlet />
      </ModalProvider>
    </div>
  );
}

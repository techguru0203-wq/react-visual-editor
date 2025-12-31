import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { LegacyDocumentOutput } from '../../project/types/projectType';

import './DropdownOperMenu.scss';

interface DocumentDropdownMenuProps {
  document: LegacyDocumentOutput;
}

enum DropdownOption {
  EDIT_DOCUMENT = 'EDIT_DOCUMENT',
  DELETE_DOCUMENT = 'DELETE_DOCUMENT',
}
const items = [
  {
    label: 'Edit Document',
    key: DropdownOption.EDIT_DOCUMENT,
    icon: <EditOutlined />,
  },
  {
    label: 'Delete Document',
    key: DropdownOption.DELETE_DOCUMENT,
    icon: <DeleteOutlined />,
  },
];

export function DocumentDropdownOperMenu({
  document,
}: DocumentDropdownMenuProps) {
  const { showAppModal } = useAppModal();
  const { user, isAdmin } = useCurrentUser();

  function handleMenuClick(e: { key: string; item: any }) {
    if (e.key === DropdownOption.EDIT_DOCUMENT) {
      showAppModal({ type: 'editDocument', document: document });
    } else {
      showAppModal({ type: 'deleteDocument', document: document });
    }
  }

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  return document.creatorUserId === user?.id || isAdmin ? (
    <Dropdown
      menu={menuProps}
      trigger={['click']}
      className="dropdown-operation"
    >
      <div
        style={{
          fontSize: '20px',
          textAlign: 'center',
          position: 'relative',
          cursor: 'pointer',
          top: '-5px',
        }}
      >
        ...
      </div>
    </Dropdown>
  ) : (
    <></>
  );
}

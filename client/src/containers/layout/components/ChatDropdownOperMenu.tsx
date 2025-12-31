import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { ChatSession } from '@prisma/client';
import { Dropdown } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';

import './DropdownOperMenu.scss';

interface ChatDropdownMenuProps {
  chat: ChatSession;
}

enum DropdownOption {
  EDIT_IDEA = 'EDIT_IDEA',
  DELETE_IDEA = 'DELETE_IDEA',
  CONVERT_DOC = 'CONVERT_DOC',
}
const items = [
  {
    label: 'Edit Idea',
    key: DropdownOption.EDIT_IDEA,
    icon: <EditOutlined />,
  },
  {
    label: 'Delete Idea',
    key: DropdownOption.DELETE_IDEA,
    icon: <DeleteOutlined />,
  },
];

export function ChatDropdownOperMenu({ chat }: ChatDropdownMenuProps) {
  const { showAppModal } = useAppModal();
  const { user, isAdmin } = useCurrentUser();

  function handleMenuClick(e: { key: string; item: any }) {
    if (e.key === DropdownOption.EDIT_IDEA) {
      showAppModal({ type: 'editChat', chat });
    } else if (e.key === DropdownOption.DELETE_IDEA) {
      showAppModal({ type: 'deleteChat', chat });
    }
  }

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  return chat.userId === user?.id || isAdmin ? (
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

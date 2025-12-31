import { memo, useCallback, useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Popover, Select, Space, Spin, Typography } from 'antd';
import Avatar from 'react-avatar';

import { useTeamOrOrganizationUsers } from '../../containers/team/hooks/useTeamOrOrganizationUsers';
import { useLanguage } from '../contexts/languageContext';
import { UserInfo } from '../types/common';
import { getDisplayInfo } from './UserCard';

type UserAvatarProps = Readonly<{
  user?: UserInfo | null;
  disabled?: boolean;
  size?: string;
}>;

type EditableUserAvatarProps = UserAvatarProps &
  Readonly<{
    validUsers: ReadonlyArray<UserInfo>;
    onChange: (newUserId: string) => void;
  }>;

const DEFAULT_SIZE = '32';

export function UserAvatar({ user, disabled, size }: UserAvatarProps) {
  return (
    <Avatar
      className="user-profile"
      name={user?.username || '?'}
      email={user?.email}
      maxInitials={2}
      round={'50%'}
      size={size || DEFAULT_SIZE}
      style={
        disabled ? { opacity: 0.5 } : { cursor: 'pointer', fontSize: '16px' }
      }
      title=""
    />
  );
}

export function EditableUserAvatar({
  validUsers,
  onChange,
  ...avatarProps
}: EditableUserAvatarProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const changeAndClose = useCallback(
    (newUserid: string) => {
      setIsOpen(false);
      onChange(newUserid);
    },
    [onChange]
  );

  return (
    <Popover
      placement="right"
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      content={
        <Select
          options={validUsers.map((option) => ({
            label: option.username,
            value: option.id,
          }))}
          defaultValue={avatarProps.user?.id}
          placeholder={t('common.selectOwner')}
          optionFilterProp="children"
          showSearch
          popupMatchSelectWidth={false}
          onChange={changeAndClose}
          disabled={avatarProps.disabled}
        />
      }
    >
      <Space>
        <UserAvatar {...avatarProps} />
      </Space>
    </Popover>
  );
}
export const MemoUserAvatar = memo(EditableUserAvatar);

type EditableUserAvatarForTeamProps = Readonly<{
  userId: string;
  onChange: (newUserId: string) => void;
  size?: string;
}>;

// This function is used to allow switching assigners for a tasks in dev plan creation
// It is used in the DevPlanEditorItemTitle component
// TODO: We may pass in teamId to the input and filter the users by teamId
export function EditableUserAvatarForTeam({
  userId,
  onChange,
  size,
}: EditableUserAvatarForTeamProps) {
  const {
    data: users,
    isLoading,
    isError,
    error,
  } = useTeamOrOrganizationUsers({ source: 'team' });

  if (isError) {
    throw error;
  }
  if (isLoading || !users) {
    return <Spin />;
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    console.log('Could not find a user', userId);
    return <QuestionCircleOutlined />;
  }
  let displayInfo = getDisplayInfo(user, 'username');
  return (
    <Space>
      <EditableUserAvatar validUsers={users} user={user} onChange={onChange} />
      <Typography.Text
        style={{ width: 70 }}
        ellipsis={{ tooltip: displayInfo }}
      >
        {displayInfo}
      </Typography.Text>
    </Space>
  );
}

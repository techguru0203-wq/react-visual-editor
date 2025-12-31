import { QuestionCircleOutlined } from '@ant-design/icons';
import { User } from '@prisma/client';
import { Space, Spin, Typography } from 'antd';

import { useOrganizationUsers } from '../../containers/organization/hooks/useOrganizationUsers';
import { getSpecialtyDisplayName } from '../../containers/profile/profileUtils';
import { useLanguage } from '../contexts/languageContext';
import { UserAvatar } from './UserAvatar';

export type UserInformationType = keyof Omit<
  User,
  | 'id'
  | 'organizationId'
  | 'role'
  | 'status'
  | 'meta'
  | 'updatedAt'
  | 'createdAt'
>;

type UserCardProps = Readonly<{
  user: User;
  secondaryInformation?: ReadonlyArray<UserInformationType>;
}>;

export function UserCard({ user, secondaryInformation }: UserCardProps) {
  const { t } = useLanguage();

  return (
    <Space>
      <UserAvatar user={user} />
      <Space>
        <Typography.Text>{getDisplayInfo(user, 'username', t)}</Typography.Text>
        {secondaryInformation && secondaryInformation.length !== 0 && (
          <Typography.Text>
            (
            {secondaryInformation
              .map((info) => getDisplayInfo(user, info, t))
              .join(', ')}
            )
          </Typography.Text>
        )}
      </Space>
    </Space>
  );
}

type UserIdCardProps = Pick<UserCardProps, 'secondaryInformation'> &
  Readonly<{ userId: string }>;
export function UserIdCard({ userId, secondaryInformation }: UserIdCardProps) {
  const { data: users, isLoading, isError, error } = useOrganizationUsers();

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
  return <UserCard user={user} secondaryInformation={secondaryInformation} />;
}

export function getDisplayInfo(
  user: User,
  info: UserInformationType,
  t?: (key: string) => string
): string {
  switch (info) {
    case 'username':
      return (user.username || user.email).split('@')[0];
    case 'email':
    case 'firstname':
    case 'lastname':
      return user[info];
    case 'department':
      return (
        user.department || (t ? t('profile.noDepartment') : 'No Department')
      );
    case 'velocity':
      return `${user.velocity || 10} pts`; // TODO: default velocity
    case 'specialty':
      return getSpecialtyDisplayName(user.specialty, t);
    default:
      return '';
  }
}

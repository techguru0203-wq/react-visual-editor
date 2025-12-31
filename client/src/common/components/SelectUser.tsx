import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Select, SelectProps, Tooltip } from 'antd';

import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguage } from '../contexts/languageContext';
import { isFeatureLocked, isInvitingTeamLocked } from '../util/app';
import { useAppModal } from './AppModal';
import { UserCard, UserInformationType } from './UserCard';
import { User } from '.prisma/client';

type MultipleUserProps = Readonly<{
  multiple: true;
  value?: SelectProps<string[]>['value'];
  onChange?: SelectProps<string[]>['onChange'];
}>;

type SingleUserProps = Readonly<{
  multiple?: false;
  value?: SelectProps<string>['value'];
  onChange?: SelectProps<string>['onChange'];
}>;

export type SelectUserProps = (SingleUserProps | MultipleUserProps) &
  Readonly<{
    allowClear?: boolean;
    disabled?: boolean;
    placeholder?: string;
    secondaryInformation: ReadonlyArray<UserInformationType>;
  }> &
  SelectProps;

type SelectUserPropsInternal = SelectUserProps &
  Readonly<{
    availableUsers: ReadonlyArray<User>;
  }>;

type OptionType = Readonly<{
  value: string;
  label: JSX.Element;
}>;

// Component to select a user or multiple users from a list of available users.
// This is a low-level component that doesn't look anything up for you.
// Use this when you already have the list of users to pick from
// The value will be the id of the user object.
export function SelectUser({
  allowClear,
  availableUsers,
  disabled,
  multiple,
  placeholder,
  secondaryInformation,
  value,
  onChange,
  ...selectProps
}: SelectUserPropsInternal) {
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const isVirtualAssistantLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string
  );
  const isInvitingTeamMemberLocked = isInvitingTeamLocked(
    availableUsers.length,
    subscriptionTier as string
  );

  const options: OptionType[] = availableUsers.map((user) => ({
    value: user.id,
    data: user,
    label: <UserCard user={user} secondaryInformation={secondaryInformation} />,
  }));

  return multiple ? (
    <Select
      {...selectProps}
      allowClear={allowClear}
      disabled={disabled}
      mode={'multiple'}
      options={options}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      size={'large'}
      dropdownRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: '8px 0' }} />
          <Flex vertical align="flex-start">
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                if (isInvitingTeamMemberLocked) {
                  showAppModal({
                    type: 'updateSubscription',
                    payload: {
                      email: user.email,
                      source: 'devPlanSelectUser',
                      destination: 'inviteTeam',
                    },
                  });
                } else {
                  showAppModal({ type: 'inviteUser' });
                }
              }}
            >
              {t('common.inviteUser')}
              {isInvitingTeamMemberLocked && (
                <Tooltip title={t('common.maxTeamCountReached')}>
                  <InfoCircleOutlined style={{ color: 'orange' }} />
                </Tooltip>
              )}
            </Button>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                if (isVirtualAssistantLocked) {
                  showAppModal({
                    type: 'updateSubscription',
                    payload: {
                      email: user.email,
                      source: 'devPlanSelectUser',
                      destination: 'addVirtualuser',
                    },
                  });
                } else {
                  showAppModal({ type: 'addVirtualUser' });
                }
              }}
            >
              {t('common.addVirtualTeammate')}
              {isVirtualAssistantLocked && (
                <Tooltip title={t('common.upgradeToPerformance')}>
                  <InfoCircleOutlined style={{ color: 'orange' }} />
                </Tooltip>
              )}
            </Button>
          </Flex>
        </>
      )}
    />
  ) : (
    <Select
      style={{ width: '100%' }}
      allowClear={allowClear}
      disabled={disabled}
      options={options}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      size={'large'}
    />
  );
}

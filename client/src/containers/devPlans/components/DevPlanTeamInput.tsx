import { useCallback, useEffect, useState } from 'react';
import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Flex,
  Popover,
  Tag,
  Tooltip,
  Tree,
  TreeDataNode,
} from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { SelectUserProps } from '../../../common/components/SelectUser';
import { getDisplayInfo } from '../../../common/components/UserCard';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import {
  isFeatureLocked,
  isInvitingTeamLocked,
} from '../../../common/util/app';
import { useTeamOrOrganizationUsers } from '../../team/hooks/useTeamOrOrganizationUsers';
import { DevPlanTeamMember } from '../types/devPlanTypes';
import { User } from '.prisma/client';

type DevPlanTeamInputProps = Omit<
  SelectUserProps,
  'multiple' | 'secondaryInformation' | 'value' | 'onChange' | 'disabled'
> &
  Readonly<{
    teamId?: string | null; // If this is not provided, we fall back to the organization users
    value?: ReadonlyArray<DevPlanTeamMember>;
    onChange?: (value: ReadonlyArray<DevPlanTeamMember>) => void;
    disabled?: boolean;
  }>;

export function DevPlanTeamInput({
  teamId,
  value,
  onChange,
  disabled = false,
  ...selectUserProps
}: DevPlanTeamInputProps) {
  const { t } = useLanguage();
  const {
    data: availableUsers,
    isError,
    error,
  } = useTeamOrOrganizationUsers({ source: 'team', teamId });
  const { user, subscriptionTier, subscriptionStatus } = useCurrentUser();
  const { showAppModal } = useAppModal();
  const [isOpen, setIsOpen] = useState(false);
  const [docTreeData, setDocTreeData] = useState<TreeDataNode[]>([]);
  const isInvitingTeamMemberLocked = isInvitingTeamLocked(
    (availableUsers || []).length,
    subscriptionTier as string
  );
  const isVirtualAssistantLocked =
    subscriptionTier && // allow virtual user for free plan
    isFeatureLocked(subscriptionStatus as string, subscriptionTier as string);

  useEffect(() => {
    const treeData: TreeDataNode[] = [];
    availableUsers?.forEach((item) => {
      treeData.push({
        key: String(item.id),
        title:
          getDisplayInfo(item, 'username') +
          `(${getDisplayInfo(item, 'specialty')}, ${getDisplayInfo(
            item,
            'velocity'
          )})`,
      });
    });
    setDocTreeData(treeData);
  }, [availableUsers, onChange, value]);

  useEffect(() => {
    const clickBody = () => {
      setIsOpen(false);
    };

    window.document.body.addEventListener('click', clickBody);
    return () => {
      window.document.body.removeEventListener('click', clickBody);
    };
  }, []);

  const onUserIdChange = useCallback(
    (selectedUserIds: ReadonlyArray<string>) => {
      if (availableUsers && onChange) {
        const newTeamMembers = selectedUserIds
          .map((userId) => availableUsers.find((u) => u.id === userId))
          .filter((user): user is User => Boolean(user))
          .map((user) => ({
            userId: user.id,
            specialty: user.specialty || '',
            storyPointsPerSprint: user.velocity || 10, // TODO - force a better default value here,
          }));
        onChange(newTeamMembers);
      }
    },
    [availableUsers, onChange]
  );

  console.log('Dev Plan Team input value', value);

  if (isError) {
    throw error;
  }

  const selectedNames = availableUsers
    ?.filter((item) => value?.some((user) => user.userId === item.id))
    ?.map(
      (item) =>
        getDisplayInfo(item, 'username') +
        `(${getDisplayInfo(item, 'specialty')}, ${getDisplayInfo(
          item,
          'velocity'
        )})`
    );

  return (
    <Popover
      open={isOpen}
      content={
        <Flex vertical>
          <Flex
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Tree
              style={{ maxHeight: '500px', overflow: 'auto' }}
              checkable
              defaultCheckedKeys={value?.map((user) => user.userId) as string[]}
              checkedKeys={value?.map((user) => user.userId) as string[]}
              treeData={docTreeData}
              onCheck={(checkedKeys) => {
                onUserIdChange(checkedKeys as string[]);
              }}
              disabled={disabled}
            />
          </Flex>
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
              disabled={disabled}
            >
              {t('devplan.inviteUser')}
              {isInvitingTeamMemberLocked && (
                <Tooltip title={t('devplan.maxTeamCountReached')}>
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
              disabled={disabled}
            >
              {t('devplan.addVirtualTeammate')}
              {isVirtualAssistantLocked && (
                <Tooltip title={t('devplan.upgradeToPerformance')}>
                  <InfoCircleOutlined style={{ color: 'orange' }} />
                </Tooltip>
              )}
            </Button>
          </Flex>
        </Flex>
      }
      title={t('devplan.teamMembers')}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="custom-input"
      >
        {selectedNames?.length ? (
          <>
            <div className="input-content">{selectedNames?.slice(0, 1)}</div>
            {selectedNames?.length > 1 ? (
              <Tag
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  marginRight: 0,
                }}
              >
                +{selectedNames.length - 1}
              </Tag>
            ) : (
              ''
            )}
          </>
        ) : (
          <div className="text-ellipsis placeholder">
            {t('devplan.inviteTeamOrAddVirtual')}
          </div>
        )}
      </div>
    </Popover>
  );
}

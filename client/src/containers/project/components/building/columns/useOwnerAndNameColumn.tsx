import { Flex, Input, Tooltip } from 'antd';

import { EditableUserAvatar } from '../../../../../common/components/UserAvatar';
import { useTeamOrOrganizationUsers } from '../../../../team/hooks/useTeamOrOrganizationUsers';

type OwnerAndNameColumnArgs = {
  title: string;
  teamId?: string | null;
  editableName?: boolean;
  onChange: (args: { id: string; ownerUserId?: string; name?: string }) => void;
  onIssueNameClicked?: (id: string) => void;
};

type RecordType = {
  id: string;
  name: string;
  ownerUserId?: string | null;
  parentIssue?: {
    type: string;
    name: string;
  } | null;
};

export function useOwnerAndNameColumn({
  title,
  teamId,
  editableName,
  onChange,
  onIssueNameClicked,
}: OwnerAndNameColumnArgs) {
  const {
    data: availableOwners,
    isError,
    error,
  } = useTeamOrOrganizationUsers({ source: 'team', teamId });

  if (isError) {
    throw error;
  }

  return {
    title,
    key: 'name',
    ellipsis: true,
    render: (record: RecordType) => (
      <Flex style={{ alignItems: 'center', padding: '15px 0', width: '100%' }}>
        <div>
          <EditableUserAvatar
            user={availableOwners?.find(
              (user) => user.id === record.ownerUserId
            )}
            validUsers={availableOwners || []}
            onChange={(ownerUserId) => {
              onChange({ id: record.id, ownerUserId });
            }}
          />
        </div>
        <Tooltip
          title={
            record.parentIssue
              ? `[${record.parentIssue.type}] ${record.parentIssue.name}`
              : undefined
          }
          placement="topLeft"
          overlayStyle={{ maxWidth: 600 }}
        >
          {editableName ? (
            <Input.TextArea
              autoSize={true}
              value={record.name}
              className="editiable-text clickable-text"
              style={{ cursor: 'pointer' }}
              onBlur={(e) => {
                onChange({ id: record.id, name: e.target.value });
              }}
            />
          ) : onIssueNameClicked ? (
            <span
              style={{
                cursor: 'pointer',
                marginLeft: '6px',
                width: 'calc(100% - 28px)',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onClick={() => onIssueNameClicked(record.id)}
            >
              {record.name}
            </span>
          ) : (
            <span
              style={{
                marginLeft: '6px',
                width: 'calc(100% - 28px)',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {record.name}
            </span>
          )}
        </Tooltip>
      </Flex>
    ),
  };
}

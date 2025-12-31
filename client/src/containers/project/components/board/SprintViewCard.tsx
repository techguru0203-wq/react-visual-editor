import { memo, useCallback, useState } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { Draggable } from '@hello-pangea/dnd';
import { User } from '@prisma/client';
import { Card, Space, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { IssueOutput } from '../../../../../../shared/types';
import { MemoUserAvatar } from '../../../../common/components/UserAvatar';
import { translateIssueStatus } from '../../../../common/constants';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { DashboardPath } from '../../../nav/paths';
import { useUpdateIssueMutation } from '../../hooks/useIssueMutation';

const { Paragraph, Text } = Typography;

type SprintViewCardProps = Readonly<{
  availableOwners?: ReadonlyArray<User>;
  task: IssueOutput;
  idMap: Map<string, IssueOutput>;
  index: number;
  showDescription?: boolean;
  showStatus?: boolean;
  editable?: boolean;
}>;

export function SprintViewCard({
  availableOwners,
  task,
  idMap,
  index,
  showDescription,
  showStatus,
  editable = true,
}: SprintViewCardProps) {
  const [taskOwner, setTaskOwner] = useState(task.owner);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  const handleAssigneeChange = useCallback(
    (ownerUserId: string) => {
      const newOwner =
        availableOwners?.find((user) => user.id === ownerUserId) || null;
      setTaskOwner(newOwner);
      idMap.set(task.id, {
        ...task,
        ownerUserId: ownerUserId,
        owner: newOwner,
      });
      updateIssueMutation.mutate({ id: task.id, ownerUserId });
    },
    [task, availableOwners, idMap, updateIssueMutation]
  );

  const avatar = (
    <MemoUserAvatar
      user={taskOwner}
      validUsers={availableOwners || []}
      onChange={handleAssigneeChange}
      size={'28'}
      disabled={!editable}
    />
  );

  const suffix = task?.storyPoint === 1 ? 'pt' : 'pts';
  const pointText = !task.storyPoint ? '0' : task.storyPoint;

  return (
    <Draggable
      draggableId={task.id}
      key={task.id}
      index={index}
      isDragDisabled={!editable}
    >
      {(provided) => (
        <Tooltip title={task.description} placement="right" mouseEnterDelay={1}>
          <Card
            title={
              <div>
                <Text
                  style={{
                    lineHeight: '28px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    navigate(`/${DashboardPath}/${task.shortName}`);
                  }}
                >
                  {task.shortName}{' '}
                  <Text style={{ fontWeight: 'normal', fontSize: '13px' }} code>
                    {pointText} {suffix}
                  </Text>
                  {showStatus ? (
                    <Text type={'secondary'} style={{ fontSize: '12px' }}>
                      {' '}
                      {translateIssueStatus(task.status, t)}
                    </Text>
                  ) : null}
                </Text>
                <div
                  style={{
                    float: 'right',
                  }}
                >
                  {avatar}
                </div>
              </div>
            }
            size="small"
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
          >
            <Paragraph
              ellipsis={{ rows: 2, expandable: true, symbol: <DownOutlined /> }}
              style={{
                marginBottom: 0,
              }}
            >
              {task.name}
            </Paragraph>

            {showDescription && task.description ? (
              <div>
                <Space
                  style={{
                    paddingTop: '5px',
                  }}
                >
                  <Paragraph
                    ellipsis={{
                      rows: 2,
                      expandable: true,
                      symbol: <DownOutlined />,
                    }}
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    {/* task.description is currently empty because we do not provide description as a field in issue creation */}
                    <Text>{task.description}</Text>
                  </Paragraph>
                </Space>
              </div>
            ) : null}
          </Card>
        </Tooltip>
      )}
    </Draggable>
  );
}

export const MemoSprintViewCard = memo(SprintViewCard);

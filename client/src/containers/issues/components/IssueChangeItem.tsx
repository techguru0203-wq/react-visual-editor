import { User } from '@prisma/client';
import { Flex, List, Typography } from 'antd';
import { omit } from 'lodash';

import { UserAvatar } from '../../../common/components/UserAvatar';
import { useLanguage } from '../../../common/contexts/languageContext';
import { IssueChangeHistoryOutput } from '../types/issueTypes';

function renderChanges(change: string, t: (key: string) => string) {
  const parsedHistory = omit(JSON.parse(change), [
    'id',
    'projectId',
    'workPlanId',
    'meta',
    'jiraId',
    'parentIssueId',
    'templateIssueId',
    'creatorUserId',
    'ownerUserId',
    'createdAt',
    'updatedAt',
    'shortName',
  ]);
  delete parsedHistory.id;

  const lines = [];

  for (const key in parsedHistory) {
    const value = parsedHistory[key];

    lines.push(
      <Flex justify="space-between" style={{ width: '100%' }}>
        <strong style={{ flex: 1, textAlign: 'left' }}>{key}</strong>
        <div style={{ flex: 1, textAlign: 'center' }}>{t('issue.to')}</div>
        <Typography.Text
          code
          style={{ flex: 1, textAlign: 'right' }}
          ellipsis={{ tooltip: value }}
        >
          {`${value}`}
        </Typography.Text>
      </Flex>
    );
  }

  return lines;
}

interface ChangeItemProps {
  item: IssueChangeHistoryOutput;
  users: ReadonlyArray<User>;
}

export function IssueChangeItem({ item, users }: ChangeItemProps) {
  const user = users?.find((user) => user.id === item.userId);
  const { t } = useLanguage();

  return (
    <List.Item key={item.id}>
      <Flex vertical gap={8} style={{ width: '100%' }}>
        <UserAvatar user={user} size="16" />
        <strong>{user?.firstname + ' ' + user?.lastname}</strong>
        {t('issue.modified')}
        <Flex vertical align="center" gap={2}>
          {renderChanges(item.modifiedAttribute, t)}
        </Flex>
        <span>{t('issue.at')} {`${new Date(item.createdAt).toLocaleString()}`}</span>
      </Flex>
    </List.Item>
  );
}

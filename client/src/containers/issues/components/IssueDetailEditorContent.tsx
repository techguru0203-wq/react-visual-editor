import React from 'react';
import { CaretRightOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Collapse,
  Divider,
  Flex,
  Input,
  List,
  Space,
  theme,
  Typography,
} from 'antd';
import { TextAreaRef } from 'antd/es/input/TextArea';

import { UserAvatar } from '../../../common/components/UserAvatar';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import trackEvent from '../../../trackingClient';
import { useUpdateIssueMutation } from '../../project/hooks/useIssueMutation';
import { useTeamOrOrganizationUsers } from '../../team/hooks/useTeamOrOrganizationUsers';
import { useAddIssueCommentMutation } from '../hooks/useComments';
import { CommentOutput } from '../types/commentTypes';
import { IssueChangeHistoryOutput, IssueOutput } from '../types/issueTypes';
import { IssueChangeItem } from './IssueChangeItem';

interface IssueDetailEditorContentArguments {
  issue: IssueOutput;
  comments?: CommentOutput[];
  issueChangeHistory?: IssueChangeHistoryOutput[];
  editable?: boolean;
}

export default function IssueDetailEditorContent({
  issue,
  comments,
  issueChangeHistory,
  editable = false,
}: IssueDetailEditorContentArguments) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  const addIssueCommentMutation = useAddIssueCommentMutation(issue.shortName, {
    onSuccess: () => {
      console.log('useAddIssueCommentMutation.success');
    },
    onError: (e) => {
      console.error('useAddIssueCommentMutation.error:', e);
    },
  });

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const {
    data: users,
    isError,
    error,
  } = useTeamOrOrganizationUsers({
    source: 'team',
    teamId: issue.project.teamId,
  });

  const commentInputTextRef = React.createRef<TextAreaRef>();
  function addComment() {
    const comment =
      commentInputTextRef.current?.resizableTextArea?.textArea?.value;
    if (comment) {
      addIssueCommentMutation.mutate({
        issueId: issue.shortName,
        content: comment,
      });
      // track event for comments
      trackEvent('updateIssue', {
        distinct_id: user.email,
        payload: JSON.stringify({
          issueShortName: issue.shortName,
          issueName: issue.name,
          comment,
          updateField: 'comment',
        }),
      });
    }
  }

  if (isError) {
    throw error;
  }

  return (
    <div
      style={{
        background: colorBgContainer,
        minHeight: 280,
        borderRadius: borderRadiusLG,
      }}
    >
      {/* <Input
        defaultValue={issue.name}
        className="editable-title"
        onBlur={(e) => {
          updateIssueMutation.mutate({
            id: issue.id,
            shortName: issue.shortName,
            name: e.target.value,
          });
        }}
      /> */}
      <Typography.Paragraph
        className="editable-title"
        style={{
          maxWidth: 800,
          fontWeight: 'bold',
          fontSize: '1.2rem',
          marginBottom: '0.5em',
        }}
        ellipsis={{ tooltip: issue.name }}
      >
        {issue.name}
      </Typography.Paragraph>
      <span className="issue-short-name">{issue.shortName}</span>
      <Input.TextArea
        autoSize={{ minRows: 10, maxRows: 20 }}
        defaultValue={issue.description || undefined}
        placeholder={t('issues.enterDescription')}
        className="editable-text"
        disabled={!editable}
        onBlur={(e) => {
          updateIssueMutation.mutate({
            id: issue.id,
            shortName: issue.shortName,
            description: e.target.value,
          });
          // track event
          trackEvent('updateIssue', {
            distinct_id: user.email,
            payload: JSON.stringify({
              issueShortName: issue.shortName,
              issueName: issue.name,
              updateField: 'description',
            }),
          });
        }}
      />

      <Divider />
      {false && issueChangeHistory && (
        <>
          <Collapse
            bordered={false}
            expandIcon={({ isActive }) => (
              <CaretRightOutlined rotate={isActive ? 90 : 0} />
            )}
            items={[
              {
                key: '1',
                label: t('issues.issueChangeHistory'),
                children: (
                  <Flex vertical>
                    <List
                      dataSource={(issueChangeHistory ?? []).sort(
                        (item1, item2) =>
                          new Date(item2.createdAt).getTime() -
                          new Date(item1.createdAt).getTime()
                      )}
                      renderItem={(item) => (
                        <IssueChangeItem item={item} users={users ?? []} />
                      )}
                    />
                  </Flex>
                ),
              },
            ]}
          />
          <Divider />
        </>
      )}

      {
        // Comment Part
        comments && comments.length > 0 ? (
          <>
            <Space
              direction="vertical"
              size="middle"
              style={{ display: 'flex' }}
            >
              <strong>{t('issues.comments')}</strong>
              {comments.map((comment) => (
                <Card
                  key={comment.id}
                  title={
                    <div>
                      <UserAvatar user={comment.user} size="16" />
                      <span className="comment-user-name">
                        {comment.user.firstname + ' ' + comment.user.lastname}
                      </span>
                    </div>
                  }
                  extra={new Date(
                    comment.createdAt as unknown as string
                  ).toLocaleString()}
                >
                  {comment.content}
                </Card>
              ))}
            </Space>
          </>
        ) : (
          <Typography.Paragraph>{t('issues.noComments')}</Typography.Paragraph>
        )
      }
      <div>
        <br />
        <Input.TextArea
          id="comment-input-box"
          autoSize={{ minRows: 5, maxRows: 8 }}
          placeholder={t('issues.leaveComment')}
          ref={commentInputTextRef}
          disabled={!editable}
        />
        <Button
          type="primary"
          onClick={addComment}
          style={{ marginTop: 10 }}
          disabled={!editable}
        >
          {t('issues.comment')}
        </Button>
      </div>
    </div>
  );
}

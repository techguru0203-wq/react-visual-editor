import { Col, DatePicker, Flex, Input, Row, Select } from 'antd';
import dayjs from 'dayjs';
import _ from 'lodash';

import { EditableUserAvatar } from '../../../common/components/UserAvatar';
import { getIssueStatusOptions } from '../../../common/constants';
import { useLanguage } from '../../../common/contexts/languageContext';
import trackEvent from '../../../trackingClient';
import { useUpdateIssueMutation } from '../../project/hooks/useIssueMutation';
import { useTeamOrOrganizationUsers } from '../../team/hooks/useTeamOrOrganizationUsers';
import { IssueOutput } from '../types/issueTypes';

interface IssueDetailEditorSideArguments {
  issue: IssueOutput;
  editable?: boolean;
}
export function IssueDetailEditorSide({
  issue,
  editable = true,
}: IssueDetailEditorSideArguments) {
  const { t } = useLanguage();
  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  const {
    data: availableOwners,
    isError,
    error,
  } = useTeamOrOrganizationUsers({
    source: 'team',
    teamId: issue.project.teamId,
  });
  if (isError) {
    throw error;
  }
  const user = availableOwners?.find((user) => user.id === issue.ownerUserId);

  console.log('issue:', issue);

  return (
    <div className="issueDetailSide">
      <Row>
        <Col span={8}>
          <strong>{t('issue.type')}</strong>
        </Col>
        <Col span={15}>
          <strong>{issue.type}</strong>
        </Col>
      </Row>
      <Row>
        <Col span={8}>
          <strong>{t('issue.assignee')}</strong>
        </Col>
        <Col span={15}>
          <Flex align="center" gap="middle" wrap="wrap" vertical={false}>
            <>
              <EditableUserAvatar
                user={user}
                size="20"
                validUsers={availableOwners || []}
                disabled={!editable}
                onChange={(newUserId) => {
                  updateIssueMutation.mutate({
                    id: issue.id,
                    shortName: issue.shortName,
                    ownerUserId: newUserId,
                  });
                  // track event
                  trackEvent('updateIssue', {
                    distinct_id: user?.email,
                    payload: JSON.stringify({
                      issueShortName: issue.shortName,
                      issueName: issue.name,
                      assignee:
                        'old: ' + issue.ownerUserId + ' new: ' + newUserId,
                      updateField: 'assignee',
                    }),
                  });
                }}
              />
              {user ? `${user.firstname} ${user.lastname}` : ''}
            </>
          </Flex>
        </Col>
      </Row>

      <Row>
        <Col span={8}>
          <strong>{t('issue.storyPoint')}</strong>
        </Col>
        <Col span={15}>
          <span>
            <Input
              disabled={
                (issue.type !== 'TASK' && issue.type !== 'STORY') || !editable
              }
              defaultValue={issue.storyPoint || ''}
              onBlur={(e) => {
                _.debounce(() => {
                  const storyPoint = parseInt(e.target.value);
                  console.log('e:', e, e.target.value, storyPoint);
                  if (storyPoint) {
                    updateIssueMutation.mutate({
                      id: issue.id,
                      shortName: issue.shortName,
                      storyPoint,
                    });
                    // track event
                    trackEvent('updateIssue', {
                      distinct_id: user?.email,
                      payload: JSON.stringify({
                        issueShortName: issue.shortName,
                        issueName: issue.name,
                        storyPoint:
                          'old: ' + issue.storyPoint + ' new: ' + storyPoint,
                        updateField: 'storyPoint',
                      }),
                    });
                  }
                }, 1000)();
              }}
            />
          </span>
        </Col>
      </Row>

      <Row>
        <Col span={8}>
          <strong>{t('issue.status')}</strong>
        </Col>
        <Col span={15}>
          <span>
            <Select
              options={getIssueStatusOptions(t)}
              defaultValue={issue.status}
              onChange={(status) => {
                updateIssueMutation.mutate({
                  id: issue.id,
                  shortName: issue.shortName,
                  status,
                });
                // track event
                trackEvent('updateIssue', {
                  distinct_id: user?.email,
                  payload: JSON.stringify({
                    issueShortName: issue.shortName,
                    issueName: issue.name,
                    status: 'old: ' + issue.status + ' new: ' + status,
                    updateField: 'status',
                  }),
                });
              }}
              disabled={!editable}
            />
          </span>
        </Col>
      </Row>

      <Row>
        <Col span={8}>
          <strong>{t('issue.plannedDate')}</strong>
        </Col>
        <Col span={15}>
          <span>
            <DatePicker.RangePicker
              disabled={
                (issue.type !== 'TASK' && issue.type !== 'STORY') || !editable
              }
              defaultValue={
                issue.plannedStartDate && issue.plannedEndDate
                  ? [dayjs(issue.plannedStartDate), dayjs(issue.plannedEndDate)]
                  : undefined
              }
              format="MM/DD/YYYY"
              onChange={(dates, dateStrings) => {
                updateIssueMutation.mutate({
                  id: issue.id,

                  shortName: issue.shortName,
                  plannedStartDate: new Date(dateStrings[0] || ''),
                  plannedEndDate: new Date(dateStrings[1] || ''),
                });
                // track event
                trackEvent('updateIssue', {
                  distinct_id: user?.email,
                  payload: JSON.stringify({
                    issueShortName: issue.shortName,
                    issueName: issue.name,
                    status: `[plannedStart, plannedEnd, newStart, newEnd]:${issue.plannedStartDate},${issue.plannedEndDate}, new: ${dateStrings}`,
                    updateField: 'data',
                  }),
                });
              }}
            />
          </span>
        </Col>
      </Row>

      {issue.parentIssue ? (
        <Row>
          <Col span={8}>
            <strong>{t('issue.parent')}</strong>
          </Col>
          <Col span={15}>
            <a href={issue.parentIssue.shortName}> {issue.parentIssue.name} </a>
          </Col>
        </Row>
      ) : (
        <div></div>
      )}
    </div>
  );
}

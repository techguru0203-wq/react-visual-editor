import { FC, useCallback, useEffect, useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DOCTYPE, Document } from '@prisma/client';
import { DatePicker, Flex, Form, Spin, Tooltip, Typography } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router';

import {
  ProjectAccessResponse,
  ProjectOutput,
} from '../../../../../../../shared/types';
import { useAppModal } from '../../../../../common/components/AppModal';
import { SelectTeamUser } from '../../../../../common/components/SelectTeamUser';
import { useCurrentUser } from '../../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import { ProjectPlanStatus } from '../../../../../common/types/project.types';
import { isFeatureLocked } from '../../../../../common/util/app';
import { COLORS } from '../../../../../lib/constants';
import { DocumentTypeNameMapping } from '../../../../documents/types/documentTypes';
import { useIssue } from '../../../../issues/hooks/useIssue';
import { DevPlansPath, DocumentsPath } from '../../../../nav/paths';
import { useOrganizationUsers } from '../../../../organization/hooks/useOrganizationUsers';
import { useUpdateIssueMutation } from '../../../hooks/useIssueMutation';
import { ProjectPlanStatusBadge } from './ProjectPlanStatusBadge';
import { IssueStatus } from '.prisma/client';

import './ProjectPlanCard.scss';

const statusMap: Record<string, ProjectPlanStatus> = {
  [IssueStatus.CREATED]: ProjectPlanStatus.NOT_STARTED,
  [IssueStatus.STARTED]: ProjectPlanStatus.IN_PROGRESS,
  [IssueStatus.COMPLETED]: ProjectPlanStatus.PUBLISHED,
};

export interface ProjectPlanCardProps {
  issue: any; // TODO what is the type for issues?
  project: ProjectOutput;
  access: ProjectAccessResponse;
  onClick: (e: React.MouseEvent<HTMLLIElement>) => void;
  elementId: string;
}

export const ProjectPlanCard: FC<ProjectPlanCardProps> = (props) => {
  const { t } = useLanguage();
  const { elementId, issue, project, access, onClick } = props;
  const isReadOnly = access.projectPermission === 'VIEW';

  const { data: orgUsers, isLoading, isError, error } = useOrganizationUsers();
  const { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { showAppModal } = useAppModal();

  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { id, shortName, name, ownerUserId } = issue;
  // Use owner from issue if available, otherwise look it up from orgUsers
  const issueOwner = (
    issue as { owner?: { id: string; username: string; email: string } | null }
  ).owner;
  const ownerUserIdToUse = ownerUserId || issueOwner?.id;

  const { data: fullIssue } = useIssue(issue?.shortName);
  const document = fullIssue?.documents?.[0] as Document;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      setIsSubmitting(false);
    },
    onError: (error) => {
      setIsSubmitting(false);
      throw error;
    },
  });

  const onChangeOwner = useCallback(
    (owner: string) => {
      if (fullIssue) {
        setIsSubmitting(true);
        updateIssueMutation.mutate({
          id: fullIssue.id,
          ownerUserId: owner || fullIssue.ownerUserId,
        });
      }
    },
    [fullIssue, updateIssueMutation]
  );

  const onChangeDueDate = useCallback(
    (value: Dayjs | null, dueDate: string | string[]) => {
      if (fullIssue) {
        setIsSubmitting(true);
        updateIssueMutation.mutate({
          id: fullIssue.id,
          plannedEndDate:
            new Date(dueDate as string) || fullIssue.actualEndDate,
        });
      }
    },
    [fullIssue, updateIssueMutation]
  );

  // Prefer owner from issue relation, fallback to lookup from orgUsers
  const owner =
    issueOwner || (orgUsers || []).find((user) => user.id === ownerUserIdToUse);
  const status = fullIssue?.status
    ? statusMap[fullIssue.status]
    : ProjectPlanStatus.NOT_STARTED;

  let isCardLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string
  );
  if (isCardLocked) {
    isCardLocked = [''].includes(issue.name);
  }

  const openDocument = useCallback(
    (e: React.MouseEvent<HTMLLIElement>) => {
      const target = e.target as HTMLElement;
      const closestSelector =
        target.closest('.ant-select') || target.closest('.ant-select-dropdown');
      const closestDatePicker =
        target.closest('.ant-picker') || target.closest('.ant-picker-dropdown');
      if (closestSelector || closestDatePicker || !fullIssue) {
        return;
      }

      if (isCardLocked) {
        // show modal paywall
        showAppModal({
          type: 'updateSubscription',
          payload: {
            email: user.email,
            source: 'createBuildableDocument',
            destination: `openDocument:${document.name}`,
          },
        });
        return;
      }
      if (!document) {
        onClick(e);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      console.log('Go to document: ', document);
      if (document.type === DOCTYPE.DEVELOPMENT_PLAN) {
        navigate(`/${DevPlansPath}/${document.id}`, {
          state: { autoCollapseSidepanel: true },
        });
      } else {
        navigate(`/${DocumentsPath}/${document.id}`, {
          state: { autoCollapseSidepanel: true },
        });
      }
    },
    [
      onClick,
      navigate,
      fullIssue,
      isCardLocked,
      showAppModal,
      user.email,
      document,
    ]
  );

  useEffect(() => form.resetFields(), [orgUsers, form]);

  if (isError) {
    throw error;
  }

  return (
    <Spin spinning={isLoading || isSubmitting} style={{ height: '100%' }}>
      <Flex
        vertical
        id={props.elementId}
        className="project-plan-card"
        onClick={openDocument}
      >
        <Flex
          vertical
          className="project-plan-card-header"
          data-name={name}
          data-id={id}
          data-shortname={shortName}
        >
          <Flex flex={1} align="flex-start" justify="flex-start">
            <Typography.Title level={5}>
              {isCardLocked && (
                <Tooltip title={t('common.upgradeToPerformance')}>
                  <InfoCircleOutlined style={{ color: 'orange' }} />
                </Tooltip>
              )}
              &nbsp;&nbsp;
              {name === DOCTYPE.PROTOTYPE
                ? name
                  ? DocumentTypeNameMapping(t)[name]?.nameForProject
                  : 'Prototype'
                : (name ? DocumentTypeNameMapping(t)[name]?.name : name) ||
                  name}
            </Typography.Title>
            <ProjectPlanStatusBadge status={status} />
          </Flex>
          <Flex
            style={{ fontSize: '12px', color: COLORS.GRAY, display: 'none' }}
          >
            {name
              ? DocumentTypeNameMapping(t)[name]?.subTitle || name
              : 'Document'}
          </Flex>
        </Flex>
        <Form
          form={form}
          name="editBuildable"
          size="large"
          disabled={isLoading}
          labelCol={{ span: 6 }}
          variant="borderless"
          initialValues={{
            owner: owner?.id,
            dueDate: issue.plannedEndDate && dayjs(issue.plannedEndDate),
          }}
        >
          <Flex flex={1} vertical className="project-plan-card-owner">
            <Typography.Text className="field-label" type="secondary">
              {t('project.owner')}
            </Typography.Text>
            <Form.Item
              name="owner"
              rules={[{ required: true, message: t('project.ownerRequired') }]}
              style={{ flex: 1 }}
            >
              <SelectTeamUser
                variant="borderless"
                teamId={project.teamId}
                secondaryInformation={[]}
                onChange={onChangeOwner}
                disabled={isReadOnly}
              />
            </Form.Item>
          </Flex>
          <Flex flex={1} vertical className="project-plan-card-due-date">
            <Typography.Text className="field-label" type="secondary">
              {t('project.dueDate')}
            </Typography.Text>
            <Form.Item
              name="dueDate"
              rules={[
                { required: true, message: t('project.dueDateRequired') },
              ]}
            >
              <DatePicker
                format="MM/DD/YYYY"
                allowClear={false}
                onChange={onChangeDueDate}
                disabledDate={(current) =>
                  current && current < dayjs().endOf('day')
                }
                disabled={isReadOnly}
              />
            </Form.Item>
          </Flex>
        </Form>
      </Flex>
    </Spin>
  );
};

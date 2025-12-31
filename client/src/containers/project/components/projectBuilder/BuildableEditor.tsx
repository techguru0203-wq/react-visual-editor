import { useCallback, useState } from 'react';
import { FileOutlined } from '@ant-design/icons';
import { DOCTYPE, Document, IssueStatus, ProjectStatus } from '@prisma/client';
import { Button, Card, DatePicker, Flex, Form, Space, Spin } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import { SelectTeamUser } from '../../../../common/components/SelectTeamUser';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { useIssue } from '../../../issues/hooks/useIssue';
import { DevPlansPath, DocumentsPath } from '../../../nav/paths';
import { useDeleteBuildableMutation } from '../../hooks/useDeleteBuildableMutation';
import useDocumentMutation from '../../hooks/useDocumentMutation';
import { useUpdateIssueMutation } from '../../hooks/useIssueMutation';
import { IssueBuildableTypes } from '../../types/projectType';

import './ProjectBuilder.scss';

type BuildableEditorProps = Readonly<{
  issueShortName: string;
  onSuccess: () => void;
}>;

type FormValues = Readonly<{
  owner?: string;
  dueDate?: Date;
}>;

export default function BuildableEditor({
  issueShortName,
  onSuccess,
}: BuildableEditorProps) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: issue, isLoading, isError, error } = useIssue(issueShortName);
  const { t } = useLanguage();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      setIsSubmitting(false);
      onSuccess();
    },
    onError: (error) => {
      setIsSubmitting(false);
      throw error;
    },
  });
  const { upsertDocumentMutation } = useDocumentMutation({
    onSuccess: (doc) => {
      setIsSubmitting(false);
      onSuccess();
      if (doc.type === DOCTYPE.DEVELOPMENT_PLAN) {
        navigate(`/devplan/${doc.id}`, {
          state: { autoCollapseSidepanel: true },
        });
      } else {
        navigate(`/docs/${doc.id}`, {
          state: { autoCollapseSidepanel: true },
        });
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      throw error;
    },
  });
  const deleteBuildableMutation = useDeleteBuildableMutation({
    onSuccess: () => {
      setIsSubmitting(false);
      onSuccess();
    },
    onError: (error) => {
      setIsSubmitting(false);
      throw error;
    },
  });

  const onFinish = useCallback(
    ({ owner, dueDate }: Required<FormValues>) => {
      if (issue) {
        setIsSubmitting(true);
        updateIssueMutation.mutate({
          id: issue.id,
          plannedEndDate: dueDate,
          ownerUserId: owner,
        });
      }
    },
    [issue, updateIssueMutation]
  );
  const openDocument = useCallback(
    (document: Document) => {
      onSuccess();
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
    [navigate, onSuccess]
  );
  const createDocument = useCallback(() => {
    if (issue) {
      let docType;
      switch (issue.name) {
        case IssueBuildableTypes.UIDESIGN:
          docType = DOCTYPE.UI_DESIGN;
          break;
        case IssueBuildableTypes.TECHDESIGN:
          docType = DOCTYPE.TECH_DESIGN;
          break;
        case IssueBuildableTypes.DEVELOPMENT:
          docType = DOCTYPE.DEVELOPMENT_PLAN;
          break;
        case IssueBuildableTypes.PRD:
          docType = DOCTYPE.PRD;
          break;
        case IssueBuildableTypes.QA:
          docType = DOCTYPE.QA_PLAN;
          break;
        case IssueBuildableTypes.RELEASE:
          docType = DOCTYPE.RELEASE_PLAN;
          break;
        case IssueBuildableTypes.PROPOSAL:
          docType = DOCTYPE.PROPOSAL;
          break;
        default:
          docType = DOCTYPE.OTHER;
      }
      setIsSubmitting(true);
      upsertDocumentMutation.mutate({
        issueId: issue.id,
        type: docType,
        projectId: issue.project?.id,
        name: `${issue.name} - ${issue.project?.name}`,
        description: '',
      });
    }
  }, [issue, upsertDocumentMutation]);
  const deleteBuildable = useCallback(() => {
    if (issue) {
      setIsSubmitting(true);
      deleteBuildableMutation.mutate({
        projectId: issue.projectId,
        buildableIssueId: issue.id,
      });
    }
  }, [deleteBuildableMutation, issue]);

  if (isError) {
    throw error;
  }

  if (isLoading || !issue) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Spin />
      </Flex>
    );
  }

  console.log('in containers.project.components.BuildableEditor:', issue);

  const hasDocuments = Boolean(issue.documents.length);
  const canDelete =
    issue.status !== IssueStatus.COMPLETED &&
    issue.status !== IssueStatus.CANCELED &&
    issue.project.status === ProjectStatus.CREATED;

  return (
    <Form
      form={form}
      name="editBuildable"
      size="large"
      disabled={isLoading}
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 16 }}
      onFinish={onFinish}
      initialValues={{
        owner: issue.ownerUserId,
        dueDate: issue.plannedEndDate && dayjs(issue.plannedEndDate),
      }}
    >
      <Form.Item
        name="owner"
        label={t('project.owner')}
        rules={[{ required: true, message: t('project.ownerRequired') }]}
      >
        <SelectTeamUser
          teamId={issue.project.teamId}
          secondaryInformation={['firstname', 'lastname']}
        />
      </Form.Item>
      <Form.Item
        name="dueDate"
        label={t('project.dueDate')}
        rules={[{ required: true, message: t('project.dueDateRequired') }]}
      >
        <DatePicker
          format="MM/DD/YYYY"
          disabledDate={(current) => current && current < dayjs().endOf('day')}
        />
      </Form.Item>
      <Form.Item name="documents" label={t('project.documents')}>
        {hasDocuments ? (
          <Flex vertical wrap="wrap" gap={5}>
            {issue.documents.map((document) => (
              <Card
                key={document.id}
                className="link-card"
                size="small"
                onClick={() => openDocument(document)}
              >
                <Card.Meta
                  title={document.name}
                  avatar={<FileOutlined style={{ fontSize: '2em' }} />}
                  description={`Last updated on ${dayjs(
                    document.updatedAt
                  ).format('MM/DD/YYYY')}`}
                />
              </Card>
            ))}
          </Flex>
        ) : (
          <Button
            size="middle"
            icon={<FileOutlined />}
            onClick={createDocument}
          >
            {t('project.createDocument').replace('{name}', issue.name)}
          </Button>
        )}
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={isSubmitting}>
            {t('project.save')}
          </Button>
          <Button
            disabled={!canDelete}
            loading={isSubmitting}
            onClick={deleteBuildable}
            title={
              canDelete
                ? t('project.deleteStepTooltip')
                : t('project.cannotDeleteTooltip')
            }
          >
            {t('project.delete')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

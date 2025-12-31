import { useState } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import {
  Access,
  DocumentPermissionTypes,
  ProjectPermission,
} from '@prisma/client';
import { Alert, Button, Flex, Form, Select, Typography } from 'antd';

import { LoadingScreen } from '../../../containers/layout/components/LoadingScreen';
import { SharedProjectPath } from '../../../containers/nav/paths';
import { useAddProjectPermissionMutation } from '../../../containers/project/hooks/useAddProjectPermissionMutation';
import useProjectPermissionQuery from '../../../containers/project/hooks/useProjectPermissionQuery';
import {
  DEFAULT_PROJECT_ACCESS,
  generalAccessOptions,
  projectPermissionOptions,
} from '../../../lib/constants';
import { DEFAULT_PROJECT_PERMISSION } from '../../constants';
import { useLanguage } from '../../contexts/languageContext';
import { MultiEmailInput } from '../MultiEmailInput';

import 'react-multi-email/dist/style.css';

interface ProjectSharingModalProps {
  projectId: string;
  title: string;
  projectAccess: Access;
  shareLink?: string;
  onSuccess: () => void;
}

type FormValues = {
  emails: string[];
  permission: DocumentPermissionTypes;
  accessEmails: string[];
  projectPermissions: ProjectPermission[];
  projectAccess: Access;
};

export const ProjectSharingModal = ({
  projectId,
  projectAccess,
  onSuccess: modelOnSuccess,
  shareLink,
}: ProjectSharingModalProps) => {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();

  const baseUrl = window.location.origin;
  const shareUrl = shareLink ?? `${baseUrl}/${SharedProjectPath}/${projectId}`;

  const { isLoading, data: projectPermissions } =
    useProjectPermissionQuery(projectId);

  const addProjectPermissionMutation = useAddProjectPermissionMutation({
    projectId,
    onSuccess: (data) => {
      setErrorMsg(undefined);
      modelOnSuccess();
    },
    onError: (error) => setErrorMsg(error.toString()),
  });

  const onFormValueChanged = () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);
    const isDirty = form.isFieldsTouched();
    setSubmitDisabled(!isDirty || hasErrors);
  };

  const onSubmit = (formValues: FormValues) => {
    const { emails, permission, projectPermissions, projectAccess } =
      formValues;
    if (!Boolean(emails?.length) && !Boolean(projectPermissions?.length)) {
      setErrorMsg('Please add people to share!');
    } else {
      addProjectPermissionMutation.mutate({
        projectId,
        emails,
        permission,
        projectPermissions,
        projectAccess,
        shareUrl,
      });
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      {errorMsg && (
        <Alert message={errorMsg} type="warning" style={{ margin: '16px 0' }} />
      )}
      <Form
        form={form}
        layout="vertical"
        size="large"
        initialValues={{
          shareUrl,
          permission: DEFAULT_PROJECT_PERMISSION,
          projectAccess: projectAccess || DEFAULT_PROJECT_ACCESS,
          projectPermissions,
        }}
        onFieldsChange={onFormValueChanged}
        onFinish={onSubmit}
      >
        <Flex gap={16}>
          <Form.Item label="" name="emails" style={{ flex: '1', width: 0 }}>
            <MultiEmailInput value={[]} />
          </Form.Item>
          <Form.Item name="permission">
            <Select size="large" options={projectPermissionOptions} />
          </Form.Item>
        </Flex>
        {projectPermissions && (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('sharing.peopleWithAccess')}
            </Typography.Title>
            <Form.List name="projectPermissions">
              {(fields, { remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Flex
                      key={index}
                      justify="space-between"
                      align="center"
                      gap={10}
                      style={{ margin: '10px 0' }}
                    >
                      <Form.Item noStyle name={[field.name, 'email']}>
                        <div style={{ flex: 1 }}>
                          {projectPermissions[field.name]?.email}
                        </div>
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) =>
                          prev.permission !== curr.permission
                        }
                      >
                        {() => (
                          <Form.Item
                            noStyle
                            name={[field.name, 'permission']}
                            rules={[
                              { required: true, message: 'Missing permission' },
                            ]}
                          >
                            <Select size="middle" style={{ width: 130 }}>
                              {projectPermissionOptions.map((item) => (
                                <Select.Option
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        )}
                      </Form.Item>
                      <DeleteOutlined onClick={() => remove(field.name)} />
                    </Flex>
                  ))}
                </>
              )}
            </Form.List>
          </>
        )}
        <Typography.Title level={5}>
          {t('sharing.generalAccess')}
        </Typography.Title>
        <Form.Item label="" name="projectAccess">
          <Select options={generalAccessOptions} />
        </Form.Item>
        <Typography.Title level={5}>
          {t('sharing.shareableLink')}
        </Typography.Title>
        <Typography.Paragraph
          copyable
          style={{
            backgroundColor: 'rgba(83,69,243,0.09)',
            border: '1px solid rgba(83,69,243,0.26)',
            padding: 8,
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
            margin: '5px 0',
          }}
        >
          {shareUrl}
        </Typography.Paragraph>
        <Form.Item>
          <Flex justify="center">
            <Button
              type="primary"
              htmlType="submit"
              disabled={
                submitDisabled || addProjectPermissionMutation.isLoading
              }
              loading={addProjectPermissionMutation.isLoading}
              style={{ marginTop: '16px' }}
            >
              {t('sharing.share')}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </>
  );
};

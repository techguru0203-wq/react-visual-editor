import { useState } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import {
  Access,
  DocumentPermission,
  DocumentPermissionTypes,
} from '@prisma/client';
import { Alert, Button, Flex, Form, Select, Typography } from 'antd';

import { useAddDocumentPermissionMutation } from '../../../containers/documents/hooks/useAddDocumentPermissionMutation';
import useDocumentPermissionQuery from '../../../containers/documents/hooks/useDocumentPermissionQuery';
import { LoadingScreen } from '../../../containers/layout/components/LoadingScreen';
import { SharedDocumentPath } from '../../../containers/nav/paths';
import {
  DEFAULT_DOCUMENT_ACCESS,
  documentPermissionOptions,
  generalAccessOptions,
} from '../../../lib/constants';
import { DEFAULT_DOCUMENT_PERMISSION } from '../../constants';
import { useLanguage } from '../../contexts/languageContext';
import { MultiEmailInput } from '../MultiEmailInput';

import 'react-multi-email/dist/style.css';

interface DocSharingModalProps {
  docId: string;
  title: string;
  documentAccess: Access;
  onSuccess: () => void;
}

type FormValues = {
  emails: string[];
  permission: DocumentPermissionTypes;
  accessEmails: string[];
  documentPermissions: DocumentPermission[];
  documentAccess: Access;
};

export const DocSharingModal = ({
  docId,
  documentAccess,
  onSuccess: modelOnSuccess,
}: DocSharingModalProps) => {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();

  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/${SharedDocumentPath}/${docId}`;

  const { isLoading, data: documentPermissions } =
    useDocumentPermissionQuery(docId);

  const addDocumentPermissionMutation = useAddDocumentPermissionMutation({
    documentId: docId,
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
    console.log('updating profile with these values', formValues);

    const { emails, permission, documentPermissions, documentAccess } =
      formValues;
    if (!Boolean(emails) && !Boolean(documentPermissions)) {
      setErrorMsg('Please add people to share!');
    } else {
      addDocumentPermissionMutation.mutate({
        documentId: docId,
        emails,
        permission,
        documentPermissions,
        documentAccess,
        shareUrl,
      });
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

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
          permission: DEFAULT_DOCUMENT_PERMISSION,
          documentAccess: documentAccess || DEFAULT_DOCUMENT_ACCESS,
          documentPermissions,
        }}
        onFieldsChange={onFormValueChanged}
        onFinish={onSubmit}
      >
        <Flex gap={16}>
          <Form.Item label="" name="emails" style={{ flex: '1', width: 0 }}>
            <MultiEmailInput value={[]} />
          </Form.Item>
          <Form.Item name="permission">
            <Select size="large" options={documentPermissionOptions} />
          </Form.Item>
        </Flex>
        {documentPermissions && (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('sharing.peopleWithAccess')}
            </Typography.Title>
            <Form.List name="documentPermissions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Flex
                      key={index}
                      justify="space-between"
                      align="center"
                      gap={10}
                      style={{ margin: '10px 0' }}
                    >
                      <Form.Item
                        {...field}
                        noStyle
                        name={[field.name, 'email']}
                      >
                        <div style={{ flex: 1 }}>
                          {documentPermissions[field.name]['email']}
                        </div>
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) =>
                          prevValues.permission !== curValues.permission
                        }
                      >
                        {() => (
                          <Form.Item
                            {...field}
                            label=""
                            noStyle
                            name={[field.name, 'permission']}
                            rules={[
                              {
                                required: true,
                                message: 'Missing sight',
                              },
                            ]}
                          >
                            <Select
                              size="middle"
                              disabled={!form.getFieldValue('permission')}
                              style={{
                                width: 130,
                              }}
                            >
                              {(documentPermissionOptions || []).map((item) => (
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
        <Form.Item label="" name="documentAccess">
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
            display: 'flex',
            justifyContent: 'space-between',
            whiteSpace: 'pre-wrap',
            margin: '5px 0',
          }}
        >
          {shareUrl}
        </Typography.Paragraph>
        <Form.Item label="">
          <Flex justify="center">
            <Button
              type="primary"
              htmlType="submit"
              disabled={
                submitDisabled || addDocumentPermissionMutation.isLoading
              }
              loading={addDocumentPermissionMutation.isLoading}
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

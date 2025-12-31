import { useEffect, useState } from 'react';
import { Access, DOCTYPE } from '@prisma/client';
import { Button, Form, Input, Select } from 'antd';
import { useNavigate } from 'react-router';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { generalAccessOptions } from '../../../lib/constants';
import {
  useDocumentMutation,
  useUpdateDocumentMutation,
} from '../../documents/hooks/useDocumentMutation';
import { LegacyDocumentOutput } from '../../project/types/projectType';
import { DocTypeOptionsSelection } from '../types/documentTypes';

import './AddDocument.scss';

type AddDocumentProps = Readonly<{
  document?: LegacyDocumentOutput;
  chatSessionId?: string;
  docType?: string;
  onSuccess: () => void;
}>;

export default function AddDocument({
  document,
  chatSessionId,
  docType,
  onSuccess,
}: AddDocumentProps) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { createDocumentMutation } = useDocumentMutation({
    onSuccess: (document: LegacyDocumentOutput) => {
      console.log('Successfully created document', document);
      onSuccess();
      setIsSaving(false);
      navigate(`/docs/${document.id}`);
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  const { updateDocumentMutation } = useUpdateDocumentMutation({
    onSuccess: (document: LegacyDocumentOutput) => {
      onSuccess();
      setIsSaving(false);
      if (document.type === DOCTYPE.DEVELOPMENT_PLAN) {
        navigate(`/devplan/${document.id}`);
      } else {
        navigate(`/docs/${document.id}`);
      }
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (document && form) {
      form.setFieldValue('name', document.name);
      form.setFieldValue('type', document.type);
      form.setFieldValue('access', document.access);
    }
  }, [document, form]);

  function onSubmit(values: any) {
    let { name, type, access } = values;

    if (document) {
      updateDocumentMutation.mutate({
        id: document.id,
        issueId: document.issueId,
        projectId: document.projectId,
        contentStr: document.contentStr || '',
        name,
        type,
        access,
      });
    } else {
      createDocumentMutation.mutate({
        name,
        type,
        access,
        chatSessionId,
      });
    }

    setIsSaving(true);
  }

  return (
    <>
      <Form
        form={form}
        labelCol={{ span: 4 }}
        wrapperCol={{ span: 20 }}
        onFinish={onSubmit}
        autoComplete="off"
        size="large"
        disabled={isSaving}
        initialValues={{
          ownerUserId: user.id,
          access: Access.SELF,
          type: docType,
        }}
        className="edit-document-form"
      >
        <Form.Item
          label={t('document.name')}
          name="name"
          rules={[
            { required: true, message: t('document.addDocumentNameRequired') },
          ]}
        >
          <Input placeholder={t('document.enterDocumentName')} />
        </Form.Item>
        <Form.Item
          label={t('document.type')}
          name="type"
          rules={[
            { required: true, message: t('document.chooseDocumentType') },
          ]}
        >
          <Select
            style={{ width: 200 }}
            allowClear
            options={DocTypeOptionsSelection.slice(1).filter(
              (item) =>
                item.value !== 'CHAT' && item.value !== DOCTYPE.DEVELOPMENT_PLAN
            )}
          />
        </Form.Item>
        <Form.Item
          label="Access"
          name="access"
          rules={[
            {
              required: true,
              message: t('document.selectAccessRequired'),
            },
          ]}
        >
          <Select options={generalAccessOptions} />
        </Form.Item>

        <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            {t('document.save')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}

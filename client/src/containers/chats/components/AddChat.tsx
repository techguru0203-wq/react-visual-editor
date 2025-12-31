import { useEffect, useState } from 'react';
import { Access, ChatSession } from '@prisma/client';
import { Button, Form, Input, Select } from 'antd';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import * as Path from '../../../containers/nav/paths';
import { generalAccessOptions } from '../../../lib/constants';
import { useChatMutation } from '../hooks/useChatMutation';

import './AddChat.scss';

type AddDocumentProps = Readonly<{
  chatSession?: ChatSession;
  onSuccess: () => void;
}>;

export default function AddChat({ chatSession, onSuccess }: AddDocumentProps) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { upsertChatSessionMutation } = useChatMutation({
    onSuccess: (createdChatSession: ChatSession) => {
      console.log('Successfully created chat', createdChatSession);
      onSuccess();
      setIsSaving(false);
      if (!chatSession?.id) {
        navigate(`/${Path.IdeasPath}/${createdChatSession.id}`);
      }
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (chatSession && form) {
      form.setFieldValue('name', chatSession?.name);
      form.setFieldValue('access', chatSession?.access);
    }
  }, [chatSession, form]);

  function onSubmit(values: any) {
    let { name, access } = values;

    upsertChatSessionMutation.mutate({
      id: chatSession?.id,
      name,
      access,
    });

    setIsSaving(true);
  }

  return (
    <Form
      form={form}
      labelCol={{ span: 4 }}
      wrapperCol={{ span: 20 }}
      onFinish={onSubmit}
      autoComplete="off"
      size="large"
      disabled={isSaving}
      initialValues={{ access: Access.SELF }}
      className="chat-form"
    >
      <Form.Item
        label="Name"
        name="name"
        rules={[
          {
            required: true,
            message: t('chat.addNameRequired'),
          },
        ]}
      >
        <Input placeholder={t('chat.enterNamePlaceholder')} />
      </Form.Item>
      <Form.Item
        label="Access"
        name="access"
        rules={[
          {
            required: true,
            message: t('chat.selectAccessRequired'),
          },
        ]}
      >
        <Select options={generalAccessOptions} />
      </Form.Item>
      <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
        <Button type="primary" htmlType="submit" loading={isSaving}>
          {t('chat.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}

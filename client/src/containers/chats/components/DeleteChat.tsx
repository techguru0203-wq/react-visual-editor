import { useState } from 'react';
import { ChatSession, RecordStatus } from '@prisma/client';
import { Button, Form, Typography } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import { useChatMutation } from '../hooks/useChatMutation';

type DeleteChatProps = Readonly<{
  chat: ChatSession;
  onSuccess: () => void;
}>;

export function DeleteChat({ chat, onSuccess }: DeleteChatProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const { upsertChatSessionMutation } = useChatMutation({
    onSuccess: (createdChatSession: ChatSession) => {
      console.log('Successfully deleted chat', createdChatSession);
      onSuccess();
      setIsLoading(false);
    },
    onError: () => {
      console.error('error');
      setIsLoading(false);
    },
  });

  const onSubmit = () => {
    setIsLoading(true);
    upsertChatSessionMutation.mutate({
      id: chat.id,
      name: chat.name as string,
      access: chat.access,
      status: RecordStatus.DEACTIVATED,
    });
  };

  return (
    <>
      <Form
        form={form}
        name="deleteChat"
        size="large"
        wrapperCol={{ span: 24 }}
        onFinish={onSubmit}
      >
        <Typography.Paragraph style={{ paddingBottom: '20px' }}>
          {t('chat.deleteConfirm')}
        </Typography.Paragraph>
        <Form.Item style={{ textAlign: 'end' }}>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            {t('chat.delete')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}

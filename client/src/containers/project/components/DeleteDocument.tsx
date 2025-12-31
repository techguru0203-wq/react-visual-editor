import { useState } from 'react';
import { DocumentStatus } from '@prisma/client';
import { Button, Form, Typography } from 'antd';

import { useUpdateDocumentMutation } from '../../documents/hooks/useDocumentMutation';
import { LegacyDocumentOutput } from '../types/projectType';

type DeleteDocumentProps = Readonly<{
  document: LegacyDocumentOutput;
  onSuccess: () => void;
}>;

export function DeleteDocument({ document, onSuccess }: DeleteDocumentProps) {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const { updateDocumentMutation } = useUpdateDocumentMutation({
    onSuccess: () => {
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
    updateDocumentMutation.mutate({
      id: document.id,
      issueId: document.issueId,
      projectId: document.projectId,
      type: document.type,
      contentStr: document.contentStr || '',
      status: DocumentStatus.ARCHIVED,
    });
  };

  return (
    <>
      <Form
        form={form}
        name="deleteDocument"
        size="large"
        wrapperCol={{ span: 24 }}
        onFinish={onSubmit}
      >
        <Typography.Paragraph style={{ paddingBottom: '20px' }}>
          Are you sure you want to delete this document?
        </Typography.Paragraph>
        <Form.Item style={{ textAlign: 'end' }}>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Delete
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}

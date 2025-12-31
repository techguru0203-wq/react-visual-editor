import { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useLanguage } from '../../../common/contexts/languageContext';
import { createKnowledgeBaseApi } from '../api/knowledgeBaseApi';

const { TextArea } = Input;

interface CreateKnowledgeBaseModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CreateKnowledgeBaseModal({
  open,
  onCancel,
  onSuccess,
}: CreateKnowledgeBaseModalProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await createKnowledgeBaseApi(values);
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating knowledge base:', error);
      message.error(error.message || t('knowledgeBase.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={t('knowledgeBase.create')}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t('template.create')}
      cancelText={t('common.cancel')}
      className="app-modal-with-footer"
    >
      <Form form={form} layout="vertical" style={{ marginTop: '16px' }}>
        <Form.Item
          name="name"
          label={t('knowledgeBase.name')}
          rules={[
            {
              required: true,
              message: t('knowledgeBase.nameRequired'),
            },
          ]}
        >
          <Input placeholder={t('knowledgeBase.namePlaceholder')} />
        </Form.Item>

        <Form.Item name="description" label={t('knowledgeBase.description')}>
          <TextArea
            rows={4}
            placeholder={t('knowledgeBase.descriptionPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

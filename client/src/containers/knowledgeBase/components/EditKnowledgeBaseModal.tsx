import { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useLanguage } from '../../../common/contexts/languageContext';
import { updateKnowledgeBaseApi, KnowledgeBase } from '../api/knowledgeBaseApi';

const { TextArea } = Input;

interface EditKnowledgeBaseModalProps {
  open: boolean;
  knowledgeBase: KnowledgeBase;
  onCancel: () => void;
  onSuccess: () => void;
}

export function EditKnowledgeBaseModal({
  open,
  knowledgeBase,
  onCancel,
  onSuccess,
}: EditKnowledgeBaseModalProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && knowledgeBase) {
      form.setFieldsValue({
        name: knowledgeBase.name,
        description: knowledgeBase.description || '',
      });
    }
  }, [open, knowledgeBase, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await updateKnowledgeBaseApi(knowledgeBase.id, values);
      message.success(t('knowledgeBase.updateSuccess'));
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('Error updating knowledge base:', error);
      message.error(error.message || t('knowledgeBase.updateError'));
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
      title={t('common.edit')}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t('common.save')}
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

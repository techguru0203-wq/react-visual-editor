import { useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, message } from 'antd';
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { useLanguage } from '../../../common/contexts/languageContext';
import { updateKnowledgeBaseApi } from '../api/knowledgeBaseApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface KnowledgeSettingsProps {
  knowledgeBase: any;
  onUpdate: () => void;
  onDelete: () => void;
}

export function KnowledgeSettings({
  knowledgeBase,
  onUpdate,
  onDelete,
}: KnowledgeSettingsProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await updateKnowledgeBaseApi(knowledgeBase.id, values);

      message.success(t('knowledgeBase.updateSuccess'));
      onUpdate();
    } catch (error: any) {
      message.error(error.message || t('knowledgeBase.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card title={t('knowledgeBase.basicInfo')}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: knowledgeBase.name,
            description: knowledgeBase.description,
          }}
        >
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
            <Input />
          </Form.Item>

          <Form.Item name="description" label={t('knowledgeBase.description')}>
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              {t('common.save')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={t('knowledgeBase.dangerZone')}
        style={{ marginTop: '12px' }}
        styles={{ header: { backgroundColor: '#fff1f0' } }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: '4px' }}>
              {t('knowledgeBase.deleteKnowledgeBase')}
            </Title>
            <Text type="secondary">{t('knowledgeBase.deleteWarning')}</Text>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
            {t('knowledgeBase.delete')}
          </Button>
        </Space>
      </Card>

      <Card
        title={t('knowledgeBase.information')}
        style={{ marginTop: '12px' }}
      >
        <Space direction="vertical" size="small">
          <div>
            <Text strong>{t('knowledgeBase.createdBy')}:</Text>{' '}
            <Text>{knowledgeBase.creator.username}</Text>
          </div>
          <div>
            <Text strong>{t('knowledgeBase.createdAt')}:</Text>{' '}
            <Text>{new Date(knowledgeBase.createdAt).toLocaleString()}</Text>
          </div>
          <div>
            <Text strong>{t('knowledgeBase.totalFiles')}:</Text>{' '}
            <Text>{knowledgeBase._count?.files || 0}</Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}

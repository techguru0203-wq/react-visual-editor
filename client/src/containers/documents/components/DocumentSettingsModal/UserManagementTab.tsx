import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useLanguage } from '../../../../common/contexts/languageContext';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../../../project/api/userManagementApi';
import type { StarterUser } from '../../../../shared/types/userManagement';
import { normalizeEnvSettings } from '../../../../shared/utils';
import dayjs from 'dayjs';

interface UserManagementTabProps {
  documentId?: string;
  isReadOnly?: boolean;
  environment?: 'preview' | 'production';
  doc?: any;
}

const UserManagementTab: React.FC<UserManagementTabProps> = ({
  documentId,
  isReadOnly = false,
  environment = 'preview',
  doc,
}) => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<StarterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingUser, setEditingUser] = useState<StarterUser | null>(null);

  // Get DATABASE_URL from current environment
  const envSettings = useMemo(() => {
    return normalizeEnvSettings(doc?.meta?.envSettings, environment);
  }, [doc?.meta?.envSettings, environment]);

  const columns: ColumnsType<StarterUser> = useMemo(
    () => [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      { title: 'Email', dataIndex: 'email', key: 'email' },
      {
        title: 'Created At',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (value: string | undefined) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '',
      },
      {
        title: 'Updated At',
        dataIndex: 'updated_at',
        key: 'updated_at',
        render: (value: string | undefined) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '',
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
          <Space size="small">
            <Button
              size="small"
              onClick={() => onOpenEdit(record)}
              disabled={isReadOnly}
            >
              {t('common.edit') || 'Edit'}
            </Button>
            <Button
              size="small"
              danger
              onClick={() => onConfirmDelete(record)}
              disabled={isReadOnly}
            >
              {t('common.delete') || 'Delete'}
            </Button>
          </Space>
        ),
      },
    ],
    [isReadOnly, t]
  );

  const fetchUsers = async () => {
    if (!documentId) return;

    // Check if DATABASE_URL is configured
    if (!envSettings.DATABASE_URL) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const res = await listUsers(documentId, environment);
      if (res.success) {
        setUsers(res.data.users || []);
      } else {
        message.error('Failed to fetch users');
      }
    } catch (e) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, environment, envSettings.DATABASE_URL]);

  const onOpenEdit = (user: StarterUser) => {
    setEditingUser(user);
    setVisible(true);
    setTimeout(() => {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        password: '',
        confirmPassword: '',
      });
    });
  };

  const onConfirmDelete = (user: StarterUser) => {
    Modal.confirm({
      title: t('common.delete') || 'Delete',
      content: `${t('user.deleteConfirm') || 'Are you sure to delete'}: ${
        user.email
      }?`,
      okType: 'danger',
      onOk: async () => {
        if (!documentId) return;
        try {
          setLoading(true);
          const res = await deleteUser(documentId, user.id, environment);
          if (res.success) {
            message.success(t('message.deleteSuccess') || 'Deleted');
            fetchUsers();
          } else {
            message.error(t('message.deleteFailed') || 'Delete failed');
          }
        } catch (e) {
          message.error(t('message.deleteFailed') || 'Delete failed');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const onCreate = async () => {
    if (!documentId) return;
    try {
      const values = await form.validateFields();
      setCreating(true);
      if (editingUser) {
        const payload: any = {
          name: values.name,
          email: values.email,
        };
        if (values.password) {
          payload.password = values.password;
          payload.confirmPassword = values.confirmPassword;
        }
        const res = await updateUser(
          documentId,
          editingUser.id,
          payload,
          environment
        );
        if (res.success) {
          message.success(t('message.saveSuccess') || 'Updated');
          setVisible(false);
          setEditingUser(null);
          form.resetFields();
          fetchUsers();
        } else {
          message.error(t('message.saveFailed') || 'Update failed');
        }
      } else {
        const res = await createUser(documentId, values, environment);
        if (res.success) {
          message.success(t('message.createSuccess') || 'User created');
          setVisible(false);
          form.resetFields();
          fetchUsers();
        } else {
          message.error(t('message.createFailed') || 'Create user failed');
        }
      }
    } catch (e) {
      // validation errors shown inline
    } finally {
      setCreating(false);
    }
  };

  const onOpenCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setVisible(true);
  };

  // Show message if no DATABASE_URL configured
  if (!envSettings.DATABASE_URL) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        <p>
          {t('database.noDatabaseConfigured') ||
            'No database configured for this environment'}
        </p>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          {t('database.pleaseConfigure') ||
            'Please configure your database in the Database tab first.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onOpenCreate}
          disabled={isReadOnly}
        >
          {t('user.add') || 'Add User'}
        </Button>
      </Space>
      <Table
        rowKey={(r) => r.id}
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={t('user.add') || 'Add User'}
        open={visible}
        onCancel={() => setVisible(false)}
        className="app-modal-with-footer"
        footer={[
          <Button key="cancel" onClick={() => setVisible(false)}>
            {t('settings.cancel') || 'Cancel'}
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={onCreate}
            loading={creating}
            disabled={isReadOnly}
          >
            {editingUser
              ? t('common.save') || 'Save'
              : t('common.save') || 'Save'}
          </Button>,
        ]}
        destroyOnClose
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
          }}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Name" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                required: true,
                type: 'email',
                message: 'Please enter valid email',
              },
            ]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ min: 6, message: 'At least 6 characters' }]}
          >
            <Input.Password placeholder="Password" />
          </Form.Item>
          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const pass = getFieldValue('password');
                  if (!pass && !value) return Promise.resolve();
                  if (pass === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm Password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementTab;

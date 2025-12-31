import { useEffect, useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import {
  Button,
  Flex,
  Form,
  Input,
  List,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { useWatch } from 'antd/es/form/Form';

import { createDb, resetDatabase } from '../../../project/api/databaseApi';
import { getTableData } from '../../api/databaseApi';
import { TableInfo } from './PrototypeDataBaseHandler';

interface DatabaseModalProps {
  tables: TableInfo[];
  onClose: () => void;
  settings?: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
  } | null;
  onSaveSettings?: (settings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  }) => Promise<void>;
  documentId: string;
}

interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  width?: number;
  minWidth?: number;
  ellipsis?: boolean | { showTitle: boolean };
  render?: (text: any, record: any, index: number) => React.ReactNode;
}

interface TableRecord {
  id?: string | number;
  [key: string]: any;
}

export function DatabaseModal({
  tables,
  onClose,
  settings,
  onSaveSettings,
  documentId,
}: DatabaseModalProps) {
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(!settings?.DATABASE_URL);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);

  const [localSettings, setLocalSettings] = useState(settings || {});

  function inferDbType(url?: string): 'neon' | 'supabase' {
    if (!url) return 'neon';
    if (url.includes('supabase')) return 'supabase';
    if (url.includes('.neon.tech') || url.includes('@ep-')) return 'neon';
    return 'neon';
  }

  function maskDbPassword(url: string): string {
    return url.replace(/:\/\/(.*?):(.*?)@/, '://$1:******@');
  }

  const getColumnWidth = (columnName: string): number => {
    // Calculate width based on column name patterns
    const name = columnName.toLowerCase();
    let width = 100;
    if (name.includes('user_id')) {
      width = 80;
    } else if (name.includes('id')) {
      width = 40;
    } else if (name.includes('password')) {
      width = 100;
    } else if (name.includes('email')) {
      width = 220;
    } else if (name.includes('name')) {
      width = 120;
    } else if (name.includes('created') || name.includes('updated')) {
      width = 200;
    }
    // Default width for other columns
    return width;
  };

  const watchedUrl = useWatch('DATABASE_URL', form);
  const [dbType, setDbType] = useState<'neon' | 'supabase'>(
    inferDbType(settings?.DATABASE_URL)
  );

  useEffect(() => {
    setDbType(inferDbType(watchedUrl));
  }, [watchedUrl]);

  const handleSaveSettings = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      if (onSaveSettings) {
        await onSaveSettings(values);
        setLocalSettings(values);
        message.success('Database settings saved successfully');
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('Failed to save database settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDb = async (dbType: string) => {
    try {
      setIsSaving(true);

      const deployDocMeta = JSON.parse(
        sessionStorage.getItem('deployDocMeta') || '{}'
      );
      const deployDocId = deployDocMeta?.deployDocId;

      if (!deployDocId) {
        throw new Error('No deployDocId found in sessionStorage');
      }

      const dbUrl = await createDb(deployDocId, dbType);

      if (!dbUrl) throw new Error('No database URL returned');

      const maskedUrl = maskDbPassword(dbUrl);

      message.success(
        'Your database has been created. Please close the modal and click the submit button in the chat box to continue.'
      );
      form.setFieldsValue({ DATABASE_URL: maskedUrl }); // 展示用 maskedUrl
      setDbType(dbType as 'supabase' | 'neon');

      if (onSaveSettings) {
        const newSettings = {
          DATABASE_URL: dbUrl, // 仍然保存原始的 URL
          JWT_SECRET: '',
        };
        await onSaveSettings(newSettings);
        setLocalSettings(newSettings);
      }

      setIsEditing(false);
    } catch (err: any) {
      console.error('DB creation failed:', err);
      message.error('Failed to create database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDatabase = () => {
    Modal.confirm({
      title: 'Reset Database',
      content:
        'This will permanently drop all tables and data, then rerun database migrations to recreate the database. This action cannot be undone. Are you sure you want to continue?',
      okText: 'Reset Database',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setIsSaving(true);
          const deployDocMeta = JSON.parse(
            sessionStorage.getItem('deployDocMeta') || '{}'
          );
          const deployDocId = deployDocMeta?.deployDocId;

          if (!deployDocId) {
            throw new Error('No deployDocId found in sessionStorage');
          }

          const result = await resetDatabase(deployDocId);
          if (result.success) {
            let successMessage = `Successfully dropped ${
              result.data.tablesDropped
            } tables: ${result.data.tables.join(', ')}`;

            if (result.data.filesExecuted !== undefined) {
              successMessage += `\nMigrations rerun successfully (${result.data.filesExecuted} files executed)`;
            } else if (result.data.migrationError) {
              successMessage += `\n⚠️ Migration rerun failed: ${result.data.migrationError}`;
            }

            message.success(successMessage);
            // Reload the page or refresh tables
            window.location.reload();
          } else {
            throw new Error('Failed to reset database');
          }
        } catch (error) {
          console.error('Error resetting database:', error);
          message.error(
            error instanceof Error ? error.message : 'Failed to reset database'
          );
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleTableSelect = async (tableName: string) => {
    if (!documentId) return;
    setIsLoadingTableData(true);
    setSelectedTable(tableName);
    setTableData([]);
    setTableColumns([]);

    try {
      const result = await getTableData(
        documentId,
        tableName,
        ['*'],
        localSettings.DATABASE_URL
      );
      if (result.success && result.data?.rows) {
        setTableData(result.data.rows);
        const selectedTableInfo = tables.find(
          (t: TableInfo) => t.tableName === tableName
        );
        if (selectedTableInfo) {
          setTableColumns(
            selectedTableInfo.columns.map((col) => ({
              title: col.name,
              dataIndex: col.name,
              key: col.name,
              width: getColumnWidth(col.name), // Set a reasonable fixed width
              minWidth: 50, // Minimum width as fallback
              ellipsis: {
                showTitle: false, // Don't show full text on hover
              },
              render: (text: any) => {
                if (text === null || text === undefined) {
                  return '-';
                }

                const stringValue = String(text);
                const maxWidth = getColumnWidth(col.name) - 16; // Account for padding

                // Special handling for password columns
                if (col.name.toLowerCase().includes('password')) {
                  return (
                    <div
                      style={{
                        maxWidth: maxWidth,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                        color: '#999',
                      }}
                      title="Password (hidden)"
                    >
                      {'•'.repeat(Math.min(stringValue.length, 8))}
                    </div>
                  );
                }

                return (
                  <div
                    style={{
                      maxWidth: maxWidth,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px', // Smaller font for better fit
                    }}
                    title={stringValue} // Show full text on hover
                  >
                    {stringValue}
                  </div>
                );
              },
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
      message.error('Failed to fetch table data');
    } finally {
      setIsLoadingTableData(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ fontSize: '22px', fontWeight: 600 }}>
          Database Settings
        </div>
      }
      open={true}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Space
        direction="vertical"
        size="large"
        style={{ width: '100%', rowGap: 0 }}
      >
        <div>
          {!isEditing && localSettings?.DATABASE_URL && (
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: 16,
                marginBottom: 20,
                backgroundColor: '#fafafa',
              }}
            >
              <Flex justify="space-between" align="start">
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Database URL:</strong>
                    <div style={{ wordBreak: 'break-word', marginTop: 4 }}>
                      {maskDbPassword(localSettings.DATABASE_URL)}
                    </div>
                  </div>
                  {inferDbType(localSettings.DATABASE_URL) === 'supabase' &&
                    localSettings.JWT_SECRET && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>JWT Token:</strong>
                        <div style={{ wordBreak: 'break-word', marginTop: 4 }}>
                          {localSettings.JWT_SECRET}
                        </div>
                      </div>
                    )}
                </div>
                <Button
                  type="link"
                  size="middle"
                  onClick={() => setIsEditing(true)}
                  style={{ marginTop: 4 }}
                >
                  Edit
                </Button>
              </Flex>
            </div>
          )}

          {isEditing && (
            <Form
              form={form}
              layout="vertical"
              initialValues={settings || {}}
              style={{ maxWidth: 700 }}
            >
              <Form.Item
                label="Database URL"
                required
                style={{ marginBottom: 0 }}
              >
                <Flex gap="small" align="start" wrap="wrap">
                  <Form.Item
                    name="DATABASE_URL"
                    style={{ flexGrow: 1, flexShrink: 1, minWidth: 300 }}
                    rules={[
                      {
                        required: true,
                        message: 'Please enter the database URL',
                      },
                    ]}
                  >
                    <Input placeholder="Paste your database connection string" />
                  </Form.Item>

                  {!form.getFieldValue('DATABASE_URL') && (
                    <Space>
                      <Button
                        type="primary"
                        onClick={() => handleCreateDb('neon')}
                      >
                        Auto Create
                      </Button>
                      <Tooltip title="By default we will auto-generate PostgreSQL database and provision it.">
                        <InfoCircleOutlined
                          style={{ color: '#999', cursor: 'pointer' }}
                        />
                      </Tooltip>
                    </Space>
                  )}
                </Flex>
              </Form.Item>

              {dbType === 'supabase' && (
                <Form.Item
                  label="JWT Token"
                  name="JWT_SECRET"
                  rules={[
                    {
                      required: true,
                      message: 'JWT token is required for Supabase',
                    },
                  ]}
                >
                  <Input.Password placeholder="Paste your JWT secret here" />
                </Form.Item>
              )}

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    onClick={handleSaveSettings}
                    loading={isSaving}
                  >
                    Save Settings
                  </Button>
                  <Button onClick={() => setIsEditing(false)}>Cancel</Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </div>

        <div style={{ marginTop: '-8px' }}>
          <Flex
            justify="space-between"
            align="center"
            style={{ marginBottom: 8 }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              Tables
            </Typography.Title>
            <Button
              danger
              onClick={handleResetDatabase}
              loading={isSaving}
              size="small"
            >
              Reset Database
            </Button>
          </Flex>
          <Flex style={{ maxHeight: '500px' }}>
            <div
              style={{
                width: '180px',
                borderRight: '1px solid #f0f0f0',
                padding: '16px',
                overflowY: 'auto',
              }}
            >
              <List
                size="small"
                bordered
                dataSource={tables}
                renderItem={(tableInfo: TableInfo) => (
                  <List.Item
                    onClick={() => handleTableSelect(tableInfo.tableName)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor:
                        selectedTable === tableInfo.tableName
                          ? '#e6f7ff'
                          : 'transparent',
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                        title={tableInfo.tableName}
                      >
                        {tableInfo.tableName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {tableInfo.columns.length} columns
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>

            <div
              style={{
                flex: 1,
                padding: '16px',
                overflow: 'auto',
                minWidth: 0,
              }}
            >
              {selectedTable ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <Flex justify="space-between" align="center">
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedTable}</h3>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          Columns:{' '}
                          {tables
                            .find(
                              (t: TableInfo) => t.tableName === selectedTable
                            )
                            ?.columns.map((col) => col.name)
                            .join(', ')}
                        </div>
                      </div>
                    </Flex>
                  </div>
                  <Spin spinning={isLoadingTableData}>
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <style>
                        {`
                          .ant-table-thead > tr > th,
                          .ant-table-tbody > tr > td {
                            word-wrap: break-word;
                            word-break: break-all;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                        `}
                      </style>
                      <Table
                        columns={tableColumns}
                        dataSource={tableData}
                        scroll={{ x: 'max-content', y: 400 }}
                        size="small"
                        rowKey={(record) =>
                          record.id?.toString() || Math.random().toString()
                        }
                        pagination={{
                          defaultPageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total) => `Total ${total} items`,
                        }}
                        style={{
                          minWidth: '100%',
                          tableLayout: 'fixed', // Force fixed table layout
                        }}
                      />
                    </div>
                  </Spin>
                </>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#999',
                    marginTop: '100px',
                  }}
                >
                  Select a table to view its data
                </div>
              )}
            </div>
          </Flex>
        </div>
      </Space>
    </Modal>
  );
}

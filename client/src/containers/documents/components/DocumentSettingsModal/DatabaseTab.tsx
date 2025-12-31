import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DownloadOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import trackEvent from '../../../../trackingClient';
import {
  createDb,
  getTableData,
  getTablesList,
  insertTableRow,
  batchInsertTableRows,
  resetDatabase,
  updateTableRow,
  deleteTableRowsApi,
  clearTableApi,
} from '../../../project/api/databaseApi';
import { TableColumn, TableInfo, TableRecord } from './types';
import { normalizeEnvSettings } from '../../../../shared/utils';
import SQLEditorTab from './SQLEditorTab';

interface DatabaseTabProps {
  documentId?: string;
  doc?: any;
  databaseSettings?: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
  } | null;
  onSaveDatabaseSettings?: (settings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  }) => Promise<void>;
  tables?: TableInfo[];
  setTables: (tables: TableInfo[]) => void;
  isReadOnly?: boolean;
  environment?: 'preview' | 'production';
}

interface PaginationInfo {
  current: number;
  pageSize: number;
  total: number;
}

const DatabaseTab: React.FC<DatabaseTabProps> = ({
  documentId,
  doc,
  databaseSettings,
  onSaveDatabaseSettings,
  tables,
  setTables,
  isReadOnly = false,
  environment = 'preview',
}) => {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [dbForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Configuration tab states
  const [isEditingDb, setIsEditingDb] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [localDbSettings, setLocalDbSettings] = useState(
    databaseSettings || {}
  );
  const [showJwtInput, setShowJwtInput] = useState(false);
  const [previousDatabaseUrl, setPreviousDatabaseUrl] = useState<string>('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [currentDatabaseUrl, setCurrentDatabaseUrl] = useState(
    databaseSettings?.DATABASE_URL || ''
  );
  const hasLoadedFromEnvSettings = useRef(false);

  // Tables tab states
  const [activeTab, setActiveTab] = useState('tables');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [filteredData, setFilteredData] = useState<TableRecord[]>([]);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFields, setSearchFields] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
  const [pagination, setPagination] = useState<PaginationInfo>({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Row edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TableRecord | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRowsMap, setSelectedRowsMap] = useState<
    Record<string, TableRecord>
  >({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDeletingRows, setIsDeletingRows] = useState(false);
  const [isClearingTable, setIsClearingTable] = useState(false);

  // Helpers: primary key and row key
  const getRowKey = (record: TableRecord): string => {
    const pk = getPrimaryKey(selectedTable);
    const keyCandidate = record && pk ? record[pk] : undefined;
    if (keyCandidate !== undefined && keyCandidate !== null)
      return String(keyCandidate);
    if (record && record.id !== undefined && record.id !== null)
      return String(record.id);
    try {
      return JSON.stringify(record);
    } catch {
      return Math.random().toString(36);
    }
  };

  // Load tables when database settings are available
  const loadTables = useCallback(
    async (documentId: string) => {
      try {
        setIsLoadingTables(true);
        const tablesResponse = await getTablesList(documentId, environment);
        if (tablesResponse.success) {
          setTables(tablesResponse.data.tables);
        }
      } catch (error) {
        console.error('Error loading tables:', error);
        setTables([]);
      } finally {
        setIsLoadingTables(false);
      }
    },
    [setTables, environment]
  );

  // Watch for database URL changes and environment changes
  useEffect(() => {
    // If local database settings are empty, try to retrieve from doc.meta.envSettings (only once)
    if (!localDbSettings.DATABASE_URL && !hasLoadedFromEnvSettings.current) {
      const envSettings = normalizeEnvSettings(
        doc?.meta?.envSettings,
        environment
      );
      if (envSettings.DATABASE_URL || envSettings.JWT_SECRET) {
        const newSettings = {
          DATABASE_URL: envSettings.DATABASE_URL || '',
          JWT_SECRET: envSettings.JWT_SECRET || '',
        };
        setLocalDbSettings(newSettings);
        hasLoadedFromEnvSettings.current = true; // Mark as loaded
        // Keep in view mode by default - don't auto-enter editing mode
        return; // Exit early to avoid processing empty settings
      }
      // Mark as loaded even if no envSettings exist to prevent infinite checking
      hasLoadedFromEnvSettings.current = true;
      return; // Exit early - nothing to process
    }

    // If DATABASE_URL is empty and we've already tried loading from envSettings, exit early
    if (!localDbSettings.DATABASE_URL) {
      return; // Prevent processing when URL is empty
    }

    const newDbType = inferDbType(localDbSettings.DATABASE_URL);
    setShowJwtInput(newDbType === 'supabase');

    if (localDbSettings.DATABASE_URL !== previousDatabaseUrl) {
      setSelectedTable('');
      setTableData([]);
      setTableColumns([]);
      setTables([]);
      setPreviousDatabaseUrl(localDbSettings.DATABASE_URL || '');
      setHasAttemptedLoad(false);
    }

    if (
      documentId &&
      localDbSettings.DATABASE_URL &&
      !hasAttemptedLoad &&
      (!tables || tables.length === 0)
    ) {
      setHasAttemptedLoad(true);
      loadTables(documentId);
    }
  }, [
    localDbSettings.DATABASE_URL,
    documentId,
    loadTables,
    doc?.meta?.envSettings,
    tables,
    hasAttemptedLoad,
    previousDatabaseUrl,
    setTables,
    environment,
  ]);

  // Reload settings when environment changes
  useEffect(() => {
    // Reset the flag when environment changes
    hasLoadedFromEnvSettings.current = false;

    const envSettings = normalizeEnvSettings(
      doc?.meta?.envSettings,
      environment
    );

    // Always update settings when environment changes (even if empty)
    const newSettings = {
      DATABASE_URL: envSettings.DATABASE_URL || '',
      JWT_SECRET: envSettings.JWT_SECRET || '',
    };

    setLocalDbSettings(newSettings);
    setCurrentDatabaseUrl(newSettings.DATABASE_URL || '');

    // Reset table-related state when switching environment
    setSelectedTable('');
    setTableData([]);
    setTableColumns([]);
    setTables([]);
    setHasAttemptedLoad(false);
    setPreviousDatabaseUrl('');

    // Reset editing state
    setIsEditingDb(false);

    // Mark as loaded for this environment
    hasLoadedFromEnvSettings.current = true;
  }, [environment, doc?.meta?.envSettings, setTables]);

  // Update form values when localDbSettings changes
  useEffect(() => {
    if (localDbSettings && Object.keys(localDbSettings).length > 0) {
      dbForm.setFieldsValue(localDbSettings);
      setCurrentDatabaseUrl(localDbSettings.DATABASE_URL || '');
    } else if (!localDbSettings?.DATABASE_URL) {
      dbForm.setFieldsValue({ DATABASE_URL: '', JWT_SECRET: '' });
      setCurrentDatabaseUrl('');
    }
  }, [localDbSettings, dbForm]);

  // Database helper functions
  function inferDbType(url?: string): 'neon' | 'supabase' {
    if (!url) return 'neon';
    if (url.includes('supabase')) return 'supabase';
    if (url.includes('.neon.tech') || url.includes('@ep-')) return 'neon';
    return 'neon';
  }

  function maskDbPassword(url: string): string {
    return url.replace(/:\/\/(.*?):(.*?)@/, '://$1:******@');
  }

  // Compute a reasonable minimum width (in px) to fully display the header text
  // Uses a simple character-width approximation plus padding for sort icons and cell padding
  const getHeaderMinWidth = (columnName: string): number => {
    const averageCharWidthPx = 8; // approximate average width per ASCII character
    const paddingPx = 24; // padding + sort icon spacing
    const computed = columnName.length * averageCharWidthPx + paddingPx;
    return Math.max(60, computed);
  };

  const getColumnWidth = (columnName: string): number => {
    const name = columnName.toLowerCase();
    let width = 60;
    if (name.includes('user_id')) {
      width = 50;
    } else if (name === 'id') {
      width = 30;
    } else if (name.includes('password')) {
      width = 60;
    } else if (name.includes('email')) {
      width = 120;
    } else if (name.includes('name')) {
      width = 120;
    } else if (name.includes('created') || name.includes('updated')) {
      width = 120;
    }
    // Ensure the width is never smaller than the header text's required width
    return Math.max(width, getHeaderMinWidth(columnName));
  };

  // Get primary key for a table
  const getPrimaryKey = (tableName: string): string => {
    const table = tables?.find((t) => t.tableName === tableName);
    if (!table) return 'id';

    // Look for common primary key patterns
    const pkColumn = table.columns.find(
      (col) =>
        col.name === 'id' ||
        col.name === `${tableName}_id` ||
        col.defaultValue?.includes('nextval')
    );

    return pkColumn?.name || 'id';
  };

  // Check if a field is a system-generated field
  const isSystemField = (fieldName: string): boolean => {
    const systemFieldPatterns = [
      'created_at',
      'updated_at',
      'created_date',
      'updated_date',
      'createdAt',
      'updatedAt',
      'timestamp',
      'last_modified',
      'lastModified',
    ];

    const lowerFieldName = fieldName.toLowerCase();
    return systemFieldPatterns.some((pattern) =>
      lowerFieldName.includes(pattern.toLowerCase())
    );
  };

  // Get available search fields for current table
  const getSearchableFields = (): string[] => {
    if (!selectedTable || !tables) return [];
    const table = tables.find((t) => t.tableName === selectedTable);
    return table?.columns.map((col) => col.name) || [];
  };

  // Database handler functions
  const handleSaveDatabaseSettings = async () => {
    try {
      const values = await dbForm.validateFields();
      setIsSavingDb(true);
      if (onSaveDatabaseSettings) {
        await onSaveDatabaseSettings(values);
        setLocalDbSettings(values);
        setIsEditingDb(false);
      }
    } catch (error) {
      console.error('Error saving database settings:', error);
      message.error(
        t('database.saveFailed') || 'Failed to save database settings'
      );
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleDeleteDatabaseSettings = () => {
    Modal.confirm({
      title: t('database.deleteSettings'),
      content: t('database.deleteConfirm'),
      okText: t('database.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          setIsSavingDb(true);
          if (onSaveDatabaseSettings) {
            await onSaveDatabaseSettings({
              DATABASE_URL: '',
              JWT_SECRET: '',
            });
            setLocalDbSettings({});
            setIsEditingDb(false);
            dbForm.resetFields();
            setTables([]);
            setSelectedTable('');
            setTableData([]);
            setTableColumns([]);
            setIsLoadingTableData(false);
            setIsLoadingTables(false);
            setHasAttemptedLoad(false);
            setCurrentDatabaseUrl('');
            setPreviousDatabaseUrl('');
            dbForm.setFieldsValue({
              DATABASE_URL: '',
              JWT_SECRET: '',
            });
            message.success(
              t('database.deleteSuccess') || 'Settings deleted successfully'
            );
          }
        } catch (error) {
          console.error('Error deleting database settings:', error);
          message.error(
            t('database.deleteFailed') || 'Failed to delete settings'
          );
        } finally {
          setIsSavingDb(false);
        }
      },
    });
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
          setIsSavingDb(true);
          if (documentId) {
            const result = await resetDatabase(documentId, environment);
            if (result.success) {
              await loadTables(documentId);
              setSelectedTable('');
              setTableData([]);
              setTableColumns([]);

              let successMessage = `Successfully dropped ${
                result.data.tablesDropped
              } tables: ${result.data.tables.join(', ')}`;

              if (result.data.filesExecuted !== undefined) {
                successMessage += `\nMigrations rerun successfully (${result.data.filesExecuted} files executed)`;
              } else if (result.data.migrationError) {
                successMessage += `\n⚠️ Migration rerun failed: ${result.data.migrationError}`;
              }

              Modal.success({
                title: 'Database Reset Successful',
                content: successMessage,
              });
            } else {
              throw new Error('Failed to reset database');
            }
          }
        } catch (error) {
          console.error('Error resetting database:', error);
          Modal.error({
            title: 'Reset Failed',
            content:
              error instanceof Error
                ? error.message
                : 'Failed to reset database',
          });
        } finally {
          setIsSavingDb(false);
        }
      },
    });
  };

  const handleCreateDb = async (dbType: string) => {
    try {
      if (!documentId) {
        message.error('No document ID available for database creation');
        return;
      }

      trackEvent('createDatabase', {
        distinct_id: user.email,
        payload: JSON.stringify({
          documentId: documentId,
          dbType: dbType,
        }),
      });
      setIsSavingDb(true);

      const dbUrl = await createDb(documentId, dbType);

      if (!dbUrl) throw new Error('No database URL returned');

      dbForm.setFieldsValue({ DATABASE_URL: dbUrl });
      setLocalDbSettings({ DATABASE_URL: dbUrl, JWT_SECRET: '' });

      if (onSaveDatabaseSettings) {
        const newSettings = {
          DATABASE_URL: dbUrl,
          JWT_SECRET: '',
        };
        await onSaveDatabaseSettings(newSettings);
        setLocalDbSettings(newSettings);
        setIsEditingDb(false);

        if (documentId) {
          loadTables(documentId);
          setHasAttemptedLoad(true);
        }

        message.success(
          t('database.createSuccess') || 'Database created successfully'
        );
      }
    } catch (err: any) {
      console.error('DB creation failed:', err);
      message.error(
        `Failed to create database: ${err.message || 'Unknown error'}`
      );
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleTableSelect = async (tableName: string) => {
    if (!documentId) return;
    setSelectedTable(tableName);
    setPagination({ current: 1, pageSize: 10, total: 0 });
    setSearchQuery('');
    setSearchFields([]);
    setSortField('');
    setSortOrder('ascend');
    setSelectedRowKeys([]);
    setSelectedRowsMap({});
    setFilteredData([]);
    loadTableData(tableName, 1, 10);
  };

  const loadTableData = async (
    tableName: string,
    page: number = 1,
    pageSize: number = 10
  ) => {
    if (!documentId) return;
    setIsLoadingTableData(true);
    setTableData([]);

    try {
      const result = await getTableData(
        documentId,
        tableName,
        ['*'],
        localDbSettings.DATABASE_URL,
        page,
        pageSize,
        searchQuery,
        searchFields,
        sortField,
        sortOrder
      );

      if (result.success && result.data?.rows) {
        let data = result.data.rows;

        // Server returns filtered/sorted rows; no client-side filter/sort

        const total =
          typeof result.data.total === 'number'
            ? result.data.total
            : data.length;

        setFilteredData(data);
        setTableData(data);
        setPagination({ current: page, pageSize, total });

        const selectedTableInfo = tables?.find(
          (t: TableInfo) => t.tableName === tableName
        );

        if (selectedTableInfo) {
          const columns: ColumnsType<TableRecord> =
            selectedTableInfo.columns.map((col) => {
              const minWidth = getColumnWidth(col.name);
              return {
                title: col.name,
                dataIndex: col.name,
                key: col.name,
                width: minWidth,
                onHeaderCell: () => ({ style: { minWidth } }),
                onCell: () => ({ style: { minWidth } }),
                ellipsis: true,
                sorter: true,
                render: (text: any) => {
                  if (text === null || text === undefined) {
                    return <span style={{ color: '#999' }}>NULL</span>;
                  }

                  const stringValue = String(text);

                  if (col.name.toLowerCase().includes('password')) {
                    return (
                      <span style={{ color: '#999' }}>
                        {'•'.repeat(Math.min(stringValue.length, 8))}
                      </span>
                    );
                  }

                  return <span>{stringValue}</span>;
                },
              } as any;
            });

          setTableColumns(columns as any);
        }
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
      message.error('Failed to fetch table data');
    } finally {
      setIsLoadingTableData(false);
    }
  };

  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TableRecord> | SorterResult<TableRecord>[]
  ) => {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    if (singleSorter.field) {
      setSortField(singleSorter.field as string);
      setSortOrder(singleSorter.order || 'ascend');
    }

    loadTableData(
      selectedTable,
      pagination.current || 1,
      pagination.pageSize || 10
    );
  };

  const handleSearch = () => {
    if (selectedTable) {
      loadTableData(selectedTable, 1, pagination.pageSize);
    }
  };

  const handleRowClick = (record: TableRecord) => {
    if (isReadOnly) return;
    console.log(
      'Opening edit modal for record, isReadOnly:',
      isReadOnly,
      record
    );
    setIsNewRecord(false);
    setEditingRecord(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleNewRecord = () => {
    if (isReadOnly || !selectedTable) return;
    console.log('Opening new record modal, isReadOnly:', isReadOnly);
    setIsNewRecord(true);
    setEditingRecord(null);

    // Initialize form with empty values for the table columns
    const table = tables?.find((t) => t.tableName === selectedTable);
    if (table) {
      const initialValues: Record<string, any> = {};
      table.columns.forEach((col) => {
        // Don't set initial values for auto-generated fields
        if (
          !isSystemField(col.name) &&
          col.name !== getPrimaryKey(selectedTable)
        ) {
          initialValues[col.name] = '';
        }
      });
      editForm.setFieldsValue(initialValues);
    }

    setEditModalVisible(true);
  };

  const handleSaveRecord = async () => {
    try {
      // Validate form fields
      const values = await editForm.validateFields();
      setIsSavingRecord(true);

      if (!documentId || !selectedTable) {
        message.error('Document ID or table name is missing');
        setIsSavingRecord(false);
        return;
      }

      console.log('Saving record:', { isNewRecord, selectedTable, values });

      if (isNewRecord) {
        // Insert new record
        const result = await insertTableRow(
          documentId,
          selectedTable,
          values,
          undefined,
          environment
        );
        console.log('Insert result:', result);

        if (result.success) {
          message.success(
            t('database.recordInserted') || 'Record inserted successfully'
          );
          setEditModalVisible(false);
          setEditingRecord(null);
          setIsNewRecord(false);
          editForm.resetFields();
          loadTableData(selectedTable, pagination.current, pagination.pageSize);
        } else {
          throw new Error('Failed to insert record');
        }
      } else {
        // Update existing record
        if (!editingRecord) {
          message.error('No record selected for editing');
          setIsSavingRecord(false);
          return;
        }

        const primaryKey = getPrimaryKey(selectedTable);
        const primaryKeyValue = editingRecord[primaryKey];

        console.log('Updating record:', {
          primaryKey,
          primaryKeyValue,
          values,
        });

        const result = await updateTableRow(
          documentId,
          selectedTable,
          primaryKey,
          primaryKeyValue,
          values,
          environment
        );
        console.log('Update result:', result);

        if (result.success) {
          message.success(
            t('database.recordUpdated') || 'Record updated successfully'
          );
          setEditModalVisible(false);
          setEditingRecord(null);
          editForm.resetFields();
          loadTableData(selectedTable, pagination.current, pagination.pageSize);
        } else {
          throw new Error('Failed to update record');
        }
      }
    } catch (error: any) {
      console.error('Error saving record:', error);

      // Show detailed error message
      let errorMessage = isNewRecord
        ? t('database.recordInsertFailed') || 'Failed to insert record'
        : t('database.recordUpdateFailed') || 'Failed to update record';

      if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      message.error(errorMessage);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // -------- CSV Import --------
  const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
    const rows: string[][] = [];
    let i = 0;
    const len = text.length;
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    while (i < len) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (char === ',') {
          row.push(field);
          field = '';
          i++;
          continue;
        }
        if (char === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          i++;
          continue;
        }
        if (char === '\r') {
          i++;
          continue;
        }
        field += char;
        i++;
      }
    }
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
      rows.push(row);
    }
    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);
    return { headers, rows: dataRows };
  };

  // Dynamic batch size based on total rows
  // Reduced batch sizes to prevent timeouts
  const getDynamicBatchSize = (totalRows: number): number => {
    if (totalRows < 500) return 50;
    if (totalRows < 2000) return 100;
    if (totalRows < 10000) return 200;
    return 500;
  };

  const handleClickImport = () => {
    if (isReadOnly) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = 'csvImport';
    try {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      if (!headers.length || !rows.length) {
        message.warning(t('database.noDataToImport') || 'No data to import');
        return;
      }
      const tableCols = getCurrentColumns();
      const primaryKey = getPrimaryKey(selectedTable);
      const importableHeaders = headers.filter(
        (h) => tableCols.includes(h) && !isSystemField(h) && h !== primaryKey
      );
      if (!importableHeaders.length) {
        message.error('No valid columns to import');
        return;
      }

      const toInsert = rows.map((r) => {
        const obj: Record<string, any> = {};
        importableHeaders.forEach((h) => {
          const headerIndex = headers.indexOf(h);
          obj[h] = r[headerIndex] ?? null;
        });
        // include pk if present in CSV to trigger upsert
        if (headers.includes(primaryKey)) {
          const pkIndex = headers.indexOf(primaryKey);
          obj[primaryKey] = r[pkIndex] ?? null;
        }
        return obj;
      });

      const total = toInsert.length;
      message.loading({
        content: t('database.importing') || 'Importing...',
        key,
        duration: 0,
      });

      const batchSize = getDynamicBatchSize(total);
      let success = 0;
      let fail = 0;
      let stopped = false;
      let errorMessage = '';

      for (let start = 0; start < toInsert.length; start += batchSize) {
        if (stopped) break;

        const batch = toInsert.slice(start, start + batchSize);
        const currentProgress = Math.round(
          ((start + batch.length) / total) * 100
        );

        message.loading({
          content: `${
            t('database.importing') || 'Importing'
          } ${currentProgress}% (${success + fail}/${total})...`,
          key,
          duration: 0,
        });

        try {
          // Use batch insert API for much better performance
          console.log(`Batch inserting ${batch.length} rows...`);
          const result = await batchInsertTableRows(
            String(documentId),
            selectedTable,
            batch,
            headers.includes(primaryKey) ? primaryKey : undefined,
            environment
          );

          console.log('Batch insert result:', result);

          if (result.success) {
            success += result.data.inserted;
            fail += result.data.failed;

            // Update progress after each batch
            const updatedProgress = Math.round(
              ((success + fail) / total) * 100
            );
            message.loading({
              content: `${
                t('database.importing') || 'Importing'
              } ${updatedProgress}% (${success + fail}/${total})...`,
              key,
              duration: 0,
            });

            // Stop on any error if configured to do so
            if (result.data.failed > 0 && result.data.errors.length > 0) {
              console.error('Batch insert errors:', result.data.errors);
              errorMessage = result.data.errors[0];
              stopped = true;
              break;
            }
          } else {
            // API call failed
            console.error('API call failed:', result);
            stopped = true;
            errorMessage =
              (result as any).data?.error ||
              (result as any).error ||
              'Batch insert API call failed';
            break;
          }
        } catch (err: any) {
          // Network or other critical error - stop immediately
          console.error('Exception during batch insert:', err);
          stopped = true;
          errorMessage = err.message || String(err);
          break;
        }
      }

      // Destroy loading message first
      message.destroy(key);

      if (stopped && errorMessage) {
        message.error({
          content: `${
            t('database.importStopped') || 'Import stopped due to error'
          }: ${errorMessage}. ${
            t('database.importedPartial') || 'Imported'
          } ${success}/${total} ${t('database.items') || 'items'}`,
          duration: 8,
        });
      } else {
        message.success({
          content:
            (t('database.importSummary') || 'Import finished') +
            `: ${success}/${total} ${t('database.items') || 'items'} ${
              fail ? `(failed ${fail})` : ''
            }`,
          duration: 5,
        });
      }

      if (selectedTable) loadTableData(selectedTable, 1, pagination.pageSize);
    } catch (err) {
      console.error('CSV import failed:', err);
      message.destroy(key);
      message.error(t('database.importFailed') || 'Import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // CSV helpers
  const toCsv = (rows: TableRecord[], columns: string[]): string => {
    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/[",\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const header = columns.map(escape).join(',');
    const lines = rows.map((r) => columns.map((c) => escape(r[c])).join(','));
    return [header, ...lines].join('\n');
  };

  const downloadCsv = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCurrentColumns = (): string[] => {
    const cols =
      tables?.find((t) => t.tableName === selectedTable)?.columns || [];
    return cols.map((c) => c.name);
  };

  const handleExportSelected = () => {
    const rows = selectedRowKeys
      .map((k) => selectedRowsMap[String(k)])
      .filter(Boolean);
    const columns = getCurrentColumns();
    if (rows.length === 0 || columns.length === 0) {
      message.warning(t('database.noDataToExport') || 'No data to export');
      return;
    }
    const csv = toCsv(rows, columns);
    downloadCsv(csv, `${selectedTable || 'table'}-selected.csv`);
  };

  const handleExportAll = async () => {
    if (!documentId || !selectedTable) {
      message.warning(t('database.noDataToExport') || 'No data to export');
      return;
    }
    const columns = getCurrentColumns();
    if (columns.length === 0) {
      message.warning(t('database.noDataToExport') || 'No data to export');
      return;
    }

    const key = 'exportAll';
    message.loading({
      content: t('database.exporting') || 'Exporting...',
      key,
      duration: 0,
    });

    try {
      // First request to get total count
      const first = await getTableData(
        documentId,
        selectedTable,
        ['*'],
        localDbSettings.DATABASE_URL,
        1,
        1,
        searchQuery,
        searchFields,
        sortField,
        sortOrder
      );
      const total = first?.data?.total || 0;
      if (!total) {
        message.warning({
          content: t('database.noDataToExport') || 'No data to export',
          key,
        });
        return;
      }

      const CHUNK_SIZE = 5000;
      const totalPages = Math.ceil(total / CHUNK_SIZE);
      let allRows: TableRecord[] = [];

      for (let p = 1; p <= totalPages; p++) {
        const resp = await getTableData(
          documentId,
          selectedTable,
          ['*'],
          localDbSettings.DATABASE_URL,
          p,
          CHUNK_SIZE,
          searchQuery,
          searchFields,
          sortField,
          sortOrder
        );
        if (resp?.success && Array.isArray(resp?.data?.rows)) {
          allRows = allRows.concat(resp.data.rows as TableRecord[]);
        }
      }

      // Apply current search filter across all rows
      let exportRows = allRows;
      if (searchQuery) {
        exportRows = exportRows.filter((row: TableRecord) => {
          if (searchFields.length > 0) {
            return searchFields.some((field) =>
              String(row[field])
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
            );
          }
          return Object.values(row).some((value) =>
            String(value).toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
      }

      // Apply current sort across all rows, if any
      if (sortField) {
        exportRows = [...exportRows].sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'ascend' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal);
          const bStr = String(bVal);
          return sortOrder === 'ascend'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }

      const csv = toCsv(exportRows, columns);
      downloadCsv(csv, `${selectedTable || 'table'}-all.csv`);
      message.success({
        content:
          (t('database.exported') || 'Exported') +
          ` ${exportRows.length} ${t('database.items') || 'items'}`,
        key,
      });
    } catch (err) {
      console.error('Export all failed:', err);
      message.error({
        content: t('database.exportFailed') || 'Export failed',
        key,
      });
    }
  };

  const handleDeleteSelected = () => {
    if (isReadOnly || !documentId || !selectedTable) return;

    const primaryKey = getPrimaryKey(selectedTable);
    const rows = selectedRowKeys
      .map((k) => selectedRowsMap[String(k)])
      .filter(Boolean);
    const ids = rows
      .map((r) => r[primaryKey])
      .filter((v) => v !== undefined && v !== null);

    if (ids.length === 0) {
      message.warning(t('database.noRowsSelected') || 'No rows selected');
      return;
    }

    Modal.confirm({
      title: t('database.deleteSelected') || 'Delete Selected',
      content:
        t('database.deleteSelectedConfirm') ||
        'This will permanently delete the selected rows. Continue?',
      okText: t('database.delete') || 'Delete',
      okType: 'danger',
      cancelText: t('common.cancel') || 'Cancel',
      onOk: async () => {
        try {
          setIsDeletingRows(true);
          const result = await deleteTableRowsApi(
            String(documentId),
            selectedTable,
            primaryKey,
            ids,
            environment
          );
          if (result.success) {
            message.success(
              `${t('database.deleted') || 'Deleted'} ${result.data.deleted}`
            );
            setSelectedRowKeys([]);
            setSelectedRowsMap({});
            loadTableData(
              selectedTable,
              pagination.current,
              pagination.pageSize
            );
          } else {
            throw new Error('Delete failed');
          }
        } catch (error: any) {
          message.error(
            (t('database.deleteFailed') || 'Failed to delete') +
              (error?.message ? `: ${error.message}` : '')
          );
        } finally {
          setIsDeletingRows(false);
        }
      },
    });
  };

  const handleClearTable = () => {
    if (isReadOnly || !documentId || !selectedTable) return;

    Modal.confirm({
      title: t('database.clearTable') || 'Clear Table',
      content:
        (t('database.clearTableConfirm') ||
          'This will delete all rows in this table') + '. ',
      okText: t('database.clear') || 'Clear',
      okType: 'danger',
      cancelText: t('common.cancel') || 'Cancel',
      onOk: async () => {
        try {
          setIsClearingTable(true);
          const result = await clearTableApi(
            String(documentId),
            selectedTable,
            environment
          );
          if (result.success) {
            message.success(
              t('database.tableCleared') || 'Table cleared successfully'
            );
            setSelectedRowKeys([]);
            setSelectedRowsMap({});
            loadTableData(selectedTable, 1, pagination.pageSize);
          } else {
            throw new Error('Clear table failed');
          }
        } catch (error: any) {
          message.error(
            (t('database.clearFailed') || 'Failed to clear table') +
              (error?.message ? `: ${error.message}` : '')
          );
        } finally {
          setIsClearingTable(false);
        }
      },
    });
  };

  const renderConfigurationTab = () => (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
        {t('database.configuration')}
      </h3>

      <Space
        direction="vertical"
        size="large"
        style={{ width: '100%', rowGap: 0 }}
      >
        <div>
          {!isEditingDb && localDbSettings?.DATABASE_URL && (
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: 16,
                marginBottom: 20,
                backgroundColor: '#fafafa',
                maxWidth: 1000,
              }}
            >
              <Flex justify="space-between" align="start">
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>{t('database.url')}:</strong>
                    <div style={{ wordBreak: 'break-word', marginTop: 4 }}>
                      {maskDbPassword(localDbSettings.DATABASE_URL)}
                    </div>
                  </div>
                  {localDbSettings.JWT_SECRET && (
                    <div style={{ marginBottom: 12 }}>
                      <strong>{t('database.jwtToken')}:</strong>
                      <div
                        style={{
                          wordBreak: 'break-word',
                          marginTop: 4,
                        }}
                      >
                        {'•'.repeat(
                          Math.min(localDbSettings.JWT_SECRET.length, 20)
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!isReadOnly && (
                  <Space>
                    <Button
                      type="link"
                      size="middle"
                      onClick={() => setIsEditingDb(true)}
                      style={{ padding: 0 }}
                    >
                      {t('database.edit')}
                    </Button>
                    <Button
                      type="link"
                      size="middle"
                      danger
                      onClick={handleResetDatabase}
                      loading={isSavingDb}
                      style={{ padding: 0 }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="link"
                      size="middle"
                      danger
                      onClick={handleDeleteDatabaseSettings}
                      loading={isSavingDb}
                      style={{ padding: 0 }}
                    >
                      {t('database.delete')}
                    </Button>
                  </Space>
                )}
              </Flex>
            </div>
          )}

          {(isEditingDb || !localDbSettings?.DATABASE_URL) && (
            <Form
              form={dbForm}
              layout="vertical"
              initialValues={
                localDbSettings || { DATABASE_URL: '', JWT_SECRET: '' }
              }
              style={{ maxWidth: 1000 }}
            >
              <Form.Item
                label={t('database.url')}
                required
                style={{ marginBottom: 0 }}
              >
                <Flex gap="small" align="start" wrap="wrap">
                  <Form.Item
                    name="DATABASE_URL"
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      minWidth: 300,
                      width: '300px',
                    }}
                    rules={[
                      {
                        required: true,
                        message: t('message.databaseUrlRequired'),
                      },
                    ]}
                  >
                    <Input
                      placeholder={t('database.placeholder')}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        const url = e.target.value;
                        setCurrentDatabaseUrl(url);
                        const newDbType = inferDbType(url);
                        setShowJwtInput(newDbType === 'supabase');
                      }}
                    />
                  </Form.Item>

                  {(!currentDatabaseUrl || currentDatabaseUrl.trim() === '') &&
                    !isReadOnly && (
                      <Space>
                        <Button
                          type="primary"
                          onClick={() => handleCreateDb('neon')}
                          loading={isSavingDb}
                        >
                          {t('database.autoCreate')}
                        </Button>
                        <Tooltip title={t('database.autoCreateTooltip')}>
                          <InfoCircleOutlined
                            style={{ color: '#999', cursor: 'pointer' }}
                          />
                        </Tooltip>
                      </Space>
                    )}
                </Flex>
              </Form.Item>

              {showJwtInput && (
                <Form.Item
                  label={t('database.jwtToken')}
                  name="JWT_SECRET"
                  rules={[
                    {
                      required: true,
                      message: t('database.jwtRequired'),
                    },
                  ]}
                >
                  <Input.Password
                    placeholder={t('database.jwtPlaceholder')}
                    disabled={isReadOnly}
                  />
                </Form.Item>
              )}

              {!isReadOnly && (
                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      onClick={handleSaveDatabaseSettings}
                      loading={isSavingDb}
                    >
                      {t('database.saveSettings')}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingDb(false);
                      }}
                    >
                      {t('database.cancel')}
                    </Button>
                  </Space>
                </Form.Item>
              )}
            </Form>
          )}
        </div>
      </Space>
    </div>
  );

  const renderTablesTab = () => {
    if (!localDbSettings?.DATABASE_URL) {
      return (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#999',
          }}
        >
          <Typography.Title level={4} style={{ color: '#999' }}>
            {t('database.noDatabaseConfigured') || 'No Database Configured'}
          </Typography.Title>
          <Typography.Text>
            {t('database.pleaseConfigure') ||
              'Please configure your database in the Configuration tab first.'}
          </Typography.Text>
        </div>
      );
    }

    if (!tables || tables.length === 0) {
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#999',
            border: '1px dashed #d9d9d9',
            borderRadius: '6px',
            backgroundColor: '#fafafa',
          }}
        >
          {isLoadingTables ? (
            <div style={{ padding: '24px' }}>
              <Spin />
            </div>
          ) : (
            <>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {t('database.noTables')}
              </div>
              <div style={{ fontSize: '14px' }}>
                {t('database.noTablesDesc')}
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div>
        <Flex gap="middle" style={{ height: '600px' }}>
          {/* Tables list sidebar */}
          <div
            style={{
              width: '180px',
              borderRight: '1px solid #f0f0f0',
              paddingRight: '12px',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <Typography.Title
              level={5}
              style={{ margin: '0 0 12px 0', fontSize: '14px' }}
            >
              {t('database.tables') || 'Tables'}
            </Typography.Title>
            <div>
              {tables.map((table) => (
                <div
                  key={table.tableName}
                  onClick={() => handleTableSelect(table.tableName)}
                  style={{
                    padding: '8px 10px',
                    marginBottom: '6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor:
                      selectedTable === table.tableName ? '#1890ff' : '#f5f5f5',
                    color: selectedTable === table.tableName ? '#fff' : '#000',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTable !== table.tableName) {
                      e.currentTarget.style.backgroundColor = '#e6f7ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTable !== table.tableName) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      marginBottom: '2px',
                      fontSize: '14px',
                    }}
                  >
                    {table.tableName}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>
                    {table.columns.length} {t('database.columns') || 'columns'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table data view */}
          <div
            style={{
              flex: 1,
              padding: '0 16px',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedTable ? (
              <>
                {/* Table title row */}
                <div style={{ marginBottom: '12px' }}>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {selectedTable}
                  </Typography.Title>
                </div>

                {/* Search and actions row */}
                <Flex
                  justify="space-between"
                  align="flex-start"
                  style={{ marginBottom: '16px' }}
                  wrap="wrap"
                  gap="small"
                >
                  <Space wrap>
                    <Select
                      mode="multiple"
                      placeholder={
                        t('database.selectSearchFields') ||
                        'Search in fields...'
                      }
                      value={searchFields}
                      onChange={setSearchFields}
                      style={{ width: 200 }}
                      options={getSearchableFields().map((field) => ({
                        label: field,
                        value: field,
                      }))}
                      allowClear
                      maxTagCount="responsive"
                    />
                    <Input
                      placeholder={
                        t('database.searchPlaceholder') || 'Search...'
                      }
                      prefix={<SearchOutlined />}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onPressEnter={handleSearch}
                      style={{ width: 200 }}
                      allowClear
                    />
                    <Button type="primary" onClick={handleSearch}>
                      {t('database.search') || 'Search'}
                    </Button>
                    <Button
                      onClick={() => {
                        setSearchQuery('');
                        setSearchFields([]);
                        setSortField('');
                        setSortOrder('ascend');
                        loadTableData(selectedTable, 1, pagination.pageSize);
                      }}
                    >
                      {t('database.reset') || 'Reset'}
                    </Button>
                  </Space>
                  {!isReadOnly && (
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleNewRecord}
                      >
                        {t('database.newRecord') || 'New Record'}
                      </Button>
                      <Button
                        icon={<UploadOutlined />}
                        onClick={handleClickImport}
                      >
                        {t('database.importCsv') || 'Import CSV'}
                      </Button>
                      <Button
                        danger
                        onClick={handleDeleteSelected}
                        disabled={selectedRowKeys.length === 0}
                        loading={isDeletingRows}
                      >
                        {t('database.deleteSelected') || 'Delete Selected'}
                      </Button>
                      <Button
                        danger
                        onClick={handleClearTable}
                        disabled={filteredData.length === 0}
                        loading={isClearingTable}
                      >
                        {t('database.clearTable') || 'Clear Table'}
                      </Button>
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleExportSelected()}
                        disabled={selectedRowKeys.length === 0}
                      >
                        {t('database.exportSelected') || 'Export Selected'}
                      </Button>
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleExportAll()}
                        disabled={filteredData.length === 0}
                      >
                        {t('database.exportAll') || 'Export All'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        style={{ display: 'none' }}
                        onChange={handleImportFileChange}
                      />
                    </Space>
                  )}
                </Flex>

                <Spin spinning={isLoadingTableData}>
                  <Table
                    columns={tableColumns}
                    dataSource={tableData}
                    rowKey={(record) => getRowKey(record)}
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      showSizeChanger: true,
                      showQuickJumper: false,
                      showTotal: (total) =>
                        `${t('database.items') || 'items'}: ${total}`,
                      pageSizeOptions: ['10', '20', '50', '100'],
                    }}
                    rowSelection={{
                      selectedRowKeys,
                      preserveSelectedRowKeys: true,
                      onChange: (keys, rows) => {
                        setSelectedRowKeys(keys);
                        setSelectedRowsMap((prev) => {
                          const next: Record<string, TableRecord> = { ...prev };
                          rows.forEach((r) => {
                            const k = getRowKey(r);
                            next[k] = r;
                          });
                          Object.keys(next).forEach((k) => {
                            if (!keys.includes(k)) delete next[k];
                          });
                          return next;
                        });
                      },
                    }}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                      onClick: () => handleRowClick(record),
                      style: { cursor: isReadOnly ? 'default' : 'pointer' },
                    })}
                    scroll={{ x: 'max-content' }}
                    size="small"
                  />
                </Spin>
              </>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                }}
              >
                {t('database.selectTableToView') ||
                  'Select a table from the left to view its data'}
              </div>
            )}
          </div>
        </Flex>
      </div>
    );
  };

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'tables',
            label: t('database.tables') || 'Tables',
            children: renderTablesTab(),
          },
          {
            key: 'sqlEditor',
            label: t('database.sqlEditor') || 'SQL Editor',
            children: (
              <SQLEditorTab
                documentId={documentId}
                environment={environment}
                isReadOnly={isReadOnly}
              />
            ),
          },
          {
            key: 'configuration',
            label: t('database.configuration') || 'Configuration',
            children: renderConfigurationTab(),
          },
        ]}
      />

      {/* Edit/New Record Modal */}
      {editModalVisible && (
        <Modal
          title={
            isNewRecord
              ? `${t('database.newRecord') || 'New Record'} - ${selectedTable}`
              : `${
                  t('database.editRecord') || 'Edit Record'
                } - ${selectedTable}`
          }
          open={editModalVisible}
          onCancel={() => {
            console.log('Modal cancelled');
            setEditModalVisible(false);
            setEditingRecord(null);
            setIsNewRecord(false);
            editForm.resetFields();
          }}
          width={600}
          maskClosable={false}
          keyboard={true}
          destroyOnClose={true}
          className="app-modal-with-footer"
          styles={{
            body: {
              maxHeight: '60vh',
              overflowY: 'auto',
            },
          }}
          footer={
            <Space>
              <Button
                onClick={() => {
                  setEditModalVisible(false);
                  setEditingRecord(null);
                  setIsNewRecord(false);
                  editForm.resetFields();
                }}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                type="primary"
                loading={isSavingRecord}
                onClick={handleSaveRecord}
              >
                {t('common.save') || 'Save'}
              </Button>
            </Space>
          }
        >
          <Form form={editForm} layout="vertical" style={{ marginTop: 24 }}>
            {selectedTable &&
              tables
                ?.find((t) => t.tableName === selectedTable)
                ?.columns.map((col) => {
                  const primaryKey = getPrimaryKey(selectedTable);
                  const isPrimaryKey = col.name === primaryKey;
                  const isSystemGenerated = isSystemField(col.name);
                  const isDisabled =
                    isPrimaryKey || (isSystemGenerated && !isNewRecord);

                  // Skip rendering system fields when creating new record
                  if (isNewRecord && (isPrimaryKey || isSystemGenerated)) {
                    return null;
                  }

                  let extra = '';
                  if (isPrimaryKey) {
                    extra =
                      t('database.primaryKeyNotEditable') ||
                      'Primary key (not editable)';
                  } else if (isSystemGenerated && !isNewRecord) {
                    extra =
                      t('database.systemFieldNotEditable') ||
                      'System field (not editable)';
                  } else {
                    extra = `${col.type}${
                      col.nullable ? ' (nullable)' : ' (required)'
                    }`;
                  }

                  return (
                    <Form.Item
                      key={col.name}
                      label={col.name}
                      name={col.name}
                      extra={extra}
                      rules={
                        !col.nullable && !isDisabled
                          ? [
                              {
                                required: true,
                                message: `${col.name} is required`,
                              },
                            ]
                          : undefined
                      }
                    >
                      {col.allowedValues && col.allowedValues.length > 0 ? (
                        <Select
                          disabled={isDisabled}
                          placeholder={`Select ${col.name}`}
                          options={col.allowedValues.map((v) => ({
                            label: v,
                            value: v,
                          }))}
                          allowClear
                        />
                      ) : (
                        <Input
                          disabled={isDisabled}
                          placeholder={`Enter ${col.name}`}
                        />
                      )}
                    </Form.Item>
                  );
                })}
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default DatabaseTab;

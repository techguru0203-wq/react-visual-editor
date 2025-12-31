import React, { useEffect, useRef, useState } from 'react';
import {
  DownloadOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { sql } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import {
  Button,
  Flex,
  message,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { basicSetup, EditorView } from 'codemirror';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { executeSql, getSqlHistory } from '../../../project/api/databaseApi';

interface SQLEditorTabProps {
  documentId?: string;
  environment?: 'preview' | 'production';
  isReadOnly?: boolean;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: any[];
  executionTime: number;
  truncated?: boolean;
}

interface SqlAuditLog {
  id: string;
  sqlStatement: string;
  sqlType: string;
  status: string;
  errorMessage?: string;
  rowsAffected?: number;
  executionTime?: number;
  createdAt: string;
  user: {
    email: string;
    username: string;
  };
}

const SQLEditorTab: React.FC<SQLEditorTabProps> = ({
  documentId,
  environment = 'preview',
  isReadOnly = false,
}) => {
  const { t } = useLanguage();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // Editor state
  const [sqlQuery, setSqlQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [editorHeight, setEditorHeight] = useState(150);
  const [isResizing, setIsResizing] = useState(false);

  // Results state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<SqlAuditLog[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Active tab
  const [activeResultTab, setActiveResultTab] = useState('results');

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || editorViewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        setSqlQuery(content);
      }
    });

    const keyHandler = EditorView.domEventHandlers({
      keydown: (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          handleExecute();
          return true;
        }
        return false;
      },
    });

    const state = EditorState.create({
      doc: sqlQuery,
      extensions: [
        basicSetup,
        sql(),
        updateListener,
        keyHandler,
        EditorView.editable.of(!isReadOnly),
        EditorView.theme({
          '&': { height: '100%', border: '1px solid #d9d9d9' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { width: '100%' },
          '.cm-line': { wordWrap: 'break-word', whiteSpace: 'pre-wrap' },
        }),
        EditorView.lineWrapping,
      ],
    });

    editorViewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, []);

  // Handle editor resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        if (newHeight >= 150 && newHeight <= 800) {
          setEditorHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const loadHistory = async (page: number = 1, pageSize: number = 10) => {
    if (!documentId) return;
    setIsLoadingHistory(true);
    try {
      const offset = (page - 1) * pageSize;
      const result = await getSqlHistory(
        documentId,
        environment,
        pageSize,
        offset
      );
      if (result.success && result.data) {
        setHistory(result.data.logs);
        setHistoryTotal(result.data.total);
      } else {
        console.error(
          'Error loading history:',
          (result as any).error || (result as any).message
        );
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleExecute = async () => {
    if (!documentId || !sqlQuery.trim()) {
      message.warning(
        t('database.sqlPlaceholder') || 'Please enter a SQL query'
      );
      return;
    }

    if (isReadOnly) {
      message.warning('Read-only mode');
      return;
    }

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const result = await executeSql(documentId, sqlQuery, environment);

      if (result.success && result.data) {
        setQueryResult(result.data);
        setActiveResultTab('results');
        message.success(
          t('database.sqlExecutionSuccess') || 'Query executed successfully'
        );
      } else {
        const errorMsg =
          (result as any).error ||
          (result as any).message ||
          t('database.sqlExecutionFailed') ||
          'Query execution failed';
        setQueryError(errorMsg);
        message.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg =
        error.message || t('database.sqlExecutionFailed') || 'Query failed';
      setQueryError(errorMsg);
      message.error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLoadQuery = (sqlStatement: string) => {
    if (editorViewRef.current) {
      const transaction = editorViewRef.current.state.update({
        changes: {
          from: 0,
          to: editorViewRef.current.state.doc.length,
          insert: sqlStatement,
        },
      });
      editorViewRef.current.dispatch(transaction);
      setSqlQuery(sqlStatement);
    }
  };

  const handleExportResults = () => {
    if (!queryResult || queryResult.rows.length === 0) {
      message.warning(t('database.noResults') || 'No results to export');
      return;
    }

    const columns = queryResult.fields.map((f) => f.name);
    const rows = queryResult.rows;

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
    const csv = [header, ...lines].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql-results-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success('Results exported successfully');
  };

  const renderResults = () => {
    if (queryError) {
      return (
        <div style={{ padding: '16px', color: '#ff4d4f' }}>
          <Typography.Text type="danger" strong>
            Error:
          </Typography.Text>
          <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
            {queryError}
          </pre>
        </div>
      );
    }

    if (!queryResult) {
      return (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            color: '#999',
          }}
        >
          <Typography.Text>
            {t('database.noResults') || 'No results to display'}
          </Typography.Text>
        </div>
      );
    }

    const columns = queryResult.fields.map((field) => ({
      title: field.name,
      dataIndex: field.name,
      key: field.name,
      ellipsis: true,
      render: (text: any) => {
        if (text === null || text === undefined) {
          return <span style={{ color: '#999' }}>NULL</span>;
        }
        return String(text);
      },
    }));

    return (
      <div>
        <Flex
          justify="space-between"
          align="center"
          style={{ marginBottom: 8 }}
        >
          <Space>
            <Typography.Text>
              {t('database.rowsAffected') || 'Rows'}: {queryResult.rowCount}
            </Typography.Text>
            <Typography.Text>
              {t('database.executeTime') || 'Time'}: {queryResult.executionTime}
              ms
            </Typography.Text>
            {queryResult.truncated && (
              <Tag color="warning">
                {t('database.resultsTruncated') ||
                  'Results truncated to 1000 rows'}
              </Tag>
            )}
          </Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportResults}>
            {t('database.exportResults') || 'Export Results'}
          </Button>
        </Flex>
        <Table
          columns={columns}
          dataSource={queryResult.rows}
          rowKey={(_, index) => `row-${index}`}
          size="small"
          scroll={{ x: 'max-content', y: 400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </div>
    );
  };

  const renderHistory = () => {
    const columns = [
      {
        title: 'Time',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        render: (text: string) => new Date(text).toLocaleString(),
      },
      {
        title: 'User',
        dataIndex: 'user',
        key: 'user',
        width: 150,
        render: (user: any) => user.username || user.email,
      },
      {
        title: 'Type',
        dataIndex: 'sqlType',
        key: 'sqlType',
        width: 100,
        render: (type: string) => <Tag>{type}</Tag>,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: string) => (
          <Tag color={status === 'SUCCESS' ? 'success' : 'error'}>{status}</Tag>
        ),
      },
      {
        title: 'SQL',
        dataIndex: 'sqlStatement',
        key: 'sqlStatement',
        ellipsis: true,
        render: (text: string) => (
          <Typography.Text
            ellipsis
            copyable
            style={{ maxWidth: 400, cursor: 'pointer' }}
            onClick={() => handleLoadQuery(text)}
          >
            {text}
          </Typography.Text>
        ),
      },
      {
        title: 'Rows',
        dataIndex: 'rowsAffected',
        key: 'rowsAffected',
        width: 80,
        render: (rows: number) => rows || '-',
      },
      {
        title: 'Time (ms)',
        dataIndex: 'executionTime',
        key: 'executionTime',
        width: 100,
        render: (time: number) => time || '-',
      },
    ];

    return (
      <div>
        <Flex justify="space-between" style={{ marginBottom: 8 }}>
          <Typography.Text>
            Total: {historyTotal} {t('database.items') || 'items'}
          </Typography.Text>
          <Button
            onClick={() => loadHistory(historyPage, historyPageSize)}
            loading={isLoadingHistory}
          >
            Refresh
          </Button>
        </Flex>
        <Table
          columns={columns}
          dataSource={history}
          rowKey="id"
          size="small"
          loading={isLoadingHistory}
          pagination={{
            current: historyPage,
            pageSize: historyPageSize,
            total: historyTotal,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setHistoryPage(page);
              setHistoryPageSize(pageSize);
              loadHistory(page, pageSize);
            },
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    );
  };

  if (!documentId) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#999' }}>
        <Typography.Title level={4} style={{ color: '#999' }}>
          No Document Selected
        </Typography.Title>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* SQL Editor */}
      <div style={{ marginBottom: 16 }}>
        <Flex
          justify="space-between"
          align="center"
          style={{ marginBottom: 8 }}
        >
          <Typography.Text strong>
            {t('database.sqlQuery') || 'SQL Query'}
          </Typography.Text>
          {!isReadOnly && (
            <Tooltip title="Ctrl/Cmd + Enter">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleExecute}
                loading={isExecuting}
              >
                {t('database.executeSql') || 'Execute'}
              </Button>
            </Tooltip>
          )}
        </Flex>
        <div style={{ position: 'relative' }}>
          <div ref={editorRef} style={{ height: `${editorHeight}px` }} />
          <div
            style={{
              height: '6px',
              background: isResizing ? '#1890ff' : '#f0f0f0',
              cursor: 'ns-resize',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: isResizing ? 'none' : 'background 0.2s',
            }}
            onMouseDown={() => setIsResizing(true)}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = '#d9d9d9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = '#f0f0f0';
              }
            }}
          >
            <div
              style={{
                width: '40px',
                height: '3px',
                background: '#bfbfbf',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
        {!isReadOnly && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            {t('database.onlyDmlAllowed') ||
              'Only SELECT, INSERT, UPDATE, DELETE statements are allowed'}
            <br />
            {t('database.caseSensitiveHint') ||
              'Note: Use double quotes for case-sensitive identifiers (e.g., "Users" not Users)'}
          </Typography.Text>
        )}
      </div>

      {/* Results/History Tabs */}
      <Tabs
        activeKey={activeResultTab}
        onChange={setActiveResultTab}
        items={[
          {
            key: 'results',
            label: t('database.queryResults') || 'Results',
            children: renderResults(),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined /> {t('database.queryHistory') || 'History'}
              </span>
            ),
            children: renderHistory(),
          },
        ]}
        onTabClick={(key) => {
          if (key === 'history' && history.length === 0) {
            loadHistory();
          }
        }}
      />
    </div>
  );
};

export default SQLEditorTab;

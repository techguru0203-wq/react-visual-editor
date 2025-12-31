import React, { useEffect, useRef, useState } from 'react';
import {
  DownloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { DOCTYPE } from '@prisma/client';
import { Button, Empty, message, Modal, Radio, Spin, Tabs } from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { getHeaders } from '../../../../common/util/apiHeaders';
import { api_url } from '../../../../lib/constants';

import './VercelLogsModal.scss';

const { TabPane } = Tabs;

interface BuildLogEvent {
  type: string;
  created: number;
  payload?: {
    text?: string;
    deploymentId?: string;
    info?: string;
  };
  // Vercel API may also have these fields directly
  text?: string;
  serial?: string;
  date?: number;
}

interface RuntimeLog {
  level?: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp?: string;
  created?: number;
  source?:
    | 'delimiter'
    | 'edge-function'
    | 'edge-middleware'
    | 'serverless'
    | 'request';
  requestId?: string;
  statusCode?: number;
  method?: string;
  path?: string;
  proxy?: any;
  deploymentId?: string;
}

interface VercelLogsModalProps {
  visible: boolean;
  onClose: () => void;
  previewDeploymentId?: string;
  productionDeploymentId?: string;
  projectId?: string;
  productionUrl?: string; // Production deployment URL
  previewUrl?: string; // Preview deployment URL
  documentType?: string; // Document type (PROTOTYPE or PRODUCT)
}

const VercelLogsModal: React.FC<VercelLogsModalProps> = ({
  visible,
  onClose,
  previewDeploymentId,
  productionDeploymentId,
  projectId,
  productionUrl,
  previewUrl,
  documentType,
}) => {
  const { t } = useLanguage();
  const [buildLogs, setBuildLogs] = useState<BuildLogEvent[]>([]);
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLog[]>([]);
  const [buildLogsLoading, setBuildLogsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string>('idle');
  const [activeTab, setActiveTab] = useState<'build' | 'runtime'>('build');
  const [selectedEnvironment, setSelectedEnvironment] = useState<
    'production' | 'preview'
  >('preview');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isReadyForLogsRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const processedLogsRef = useRef<Set<string>>(new Set());

  // Reset active tab to 'build' if runtime tab is hidden for prototype
  useEffect(() => {
    if (documentType === DOCTYPE.PROTOTYPE && activeTab === 'runtime') {
      setActiveTab('build');
    }
  }, [documentType, activeTab]);

  // Get the active deployment URL and ID based on selected environment
  const activeDeploymentUrl =
    selectedEnvironment === 'production' ? productionUrl : previewUrl;
  const activeDeploymentId =
    selectedEnvironment === 'production'
      ? productionDeploymentId
      : previewDeploymentId;

  useEffect(() => {
    if (visible && activeDeploymentId) {
      fetchBuildLogs();
    }
  }, [visible, activeDeploymentId, selectedEnvironment]);

  // Cleanup EventSource on unmount or modal close
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      stopStreaming();
    }
  }, [visible]);

  const fetchBuildLogs = async () => {
    if (!activeDeploymentId) {
      message.warning('No deployment ID available');
      return;
    }

    setBuildLogsLoading(true);
    try {
      const response = await fetch(
        `${api_url}/api/vercel/build-logs/${activeDeploymentId}`,
        {
          headers: await getHeaders(),
          credentials: 'include',
        }
      );

      const result = await response.json();

      if (result.success) {
        const logs = result.data || [];
        setBuildLogs(Array.isArray(logs) ? logs : []);
      } else {
        message.error(`Failed to fetch build logs: ${result.error}`);
      }
    } catch (error) {
      console.error('Error fetching build logs:', error);
      message.error('Failed to fetch build logs');
    } finally {
      setBuildLogsLoading(false);
    }
  };

  const startStreaming = async () => {
    if (!activeDeploymentUrl) {
      message.warning('Deployment URL not available for selected environment');
      return;
    }

    stopStreaming(); // Stop any existing stream
    setRuntimeLogs([]);
    processedLogsRef.current.clear(); // Clear processed logs set
    isReadyForLogsRef.current = false;
    setIsStreaming(true);
    setStreamStatus('connecting');

    try {
      const url = `${api_url}/api/vercel/runtime-logs/stream?url=${encodeURIComponent(
        activeDeploymentUrl
      )}`;

      const headers = await getHeaders();

      // Create AbortController to allow cancellation
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Use fetch instead of EventSource to support custom headers
      console.log('Initiating SSE connection to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        signal: abortController.signal,
      });

      console.log('Response status:', response.status, response.statusText);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      console.log('Stream connection established, starting to read...');
      setStreamStatus('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        try {
          let chunkCount = 0;
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log(`Stream ended after ${chunkCount} chunks`);
              setStreamStatus('ended');
              setIsStreaming(false);
              appendPlainLog('Stream ended', 'info');
              break;
            }

            chunkCount++;
            const decoded = decoder.decode(value, { stream: true });
            console.log(
              `Chunk ${chunkCount} received:`,
              decoded.substring(0, 100)
            );
            buffer += decoded;
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse SSE format: "event: eventName" or "data: content"
              if (line.startsWith('event: ')) {
                const eventType = line.substring(7).trim();
                if (eventType === 'connected') {
                  setStreamStatus('connected');
                  console.log('Stream connection established');
                } else if (eventType === 'start') {
                  setStreamStatus('running');
                }
              } else if (line.startsWith('data: ')) {
                const data = line.substring(6);

                // Check for initialization marker
                if (
                  !isReadyForLogsRef.current &&
                  data.toLowerCase().includes('waiting for new logs')
                ) {
                  isReadyForLogsRef.current = true;
                  appendPlainLog(data, 'info');
                  continue;
                }

                // Skip CLI initialization messages
                if (!isReadyForLogsRef.current) {
                  continue;
                }

                // Try to parse as JSON log entry
                try {
                  const logObj = JSON.parse(data);
                  if (logObj && typeof logObj === 'object') {
                    appendStructuredLog(logObj);
                  } else {
                    appendPlainLog(data, 'info');
                  }
                } catch {
                  // Fallback: treat as plain text
                  appendPlainLog(data, 'info');
                }
              } else if (line.startsWith(': ')) {
                // Keep-alive comment, ignore
                continue;
              }
            }
          }
        } catch (error: any) {
          // Don't show error if stream was manually aborted
          if (error.name === 'AbortError') {
            console.log('Stream aborted by user');
            return;
          }
          console.error('Stream processing error:', error);
          setStreamStatus('error');
          setIsStreaming(false);
          message.error('Stream connection lost');
        }
      };

      processStream();
    } catch (error: any) {
      // Don't show error if stream was manually aborted
      if (error.name === 'AbortError') {
        console.log('Stream aborted by user');
        return;
      }
      console.error('Error starting stream:', error);
      message.error(`Failed to start log stream: ${error.message}`);
      setIsStreaming(false);
      setStreamStatus('error');
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamStatus('stopped');
    }
  };

  // Filter out tech stack related words from log content
  const filterTechStackWords = (text: string): string => {
    if (!text) return text;

    // List of tech stack words to filter (case-insensitive)
    const techStackWords = [
      'vercel',
      'vercel cli',
      'vercel api',
      '@vercel',
      'vercel.com',
    ];

    let filteredText = text;
    techStackWords.forEach((word) => {
      // Use case-insensitive regex to remove the word
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filteredText = filteredText.replace(regex, '');
    });

    // Clean up extra whitespace that might result from removals
    filteredText = filteredText.replace(/\s+/g, ' ').trim();

    return filteredText;
  };

  const appendPlainLog = (
    text: string,
    level: 'info' | 'error' | 'warning'
  ) => {
    // Filter out tech stack words
    const filteredText = filterTechStackWords(text);

    // Generate unique identifier for deduplication
    const logId = `${filteredText}_${level}`;

    // Skip if already processed
    if (processedLogsRef.current.has(logId)) {
      return;
    }

    processedLogsRef.current.add(logId);

    const log: RuntimeLog = {
      message: filteredText,
      level,
      timestamp: new Date().toISOString(),
    };
    setRuntimeLogs((prev) => [...prev, log]);
    scrollToBottom();
  };

  const appendStructuredLog = (logObj: any) => {
    let message = logObj.message || JSON.stringify(logObj);
    const timestamp = logObj.timestamp || logObj.created;

    // Filter out tech stack words from message
    message = filterTechStackWords(message);

    // Generate unique identifier including timestamp, message, and other identifying fields
    const logId = `${timestamp}_${message}_${logObj.requestId || ''}_${
      logObj.source || ''
    }`;

    // Skip if already processed
    if (processedLogsRef.current.has(logId)) {
      return;
    }

    processedLogsRef.current.add(logId);

    const log: RuntimeLog = {
      level: logObj.level || 'info',
      message,
      timestamp,
      source: logObj.source,
      requestId: logObj.requestId,
      statusCode: logObj.statusCode,
      method: logObj.method,
      path: logObj.path,
      proxy: logObj.proxy,
      deploymentId: logObj.deploymentId,
    };
    setRuntimeLogs((prev) => [...prev, log]);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const downloadLogs = () => {
    let content = '';
    let filename = '';
    let logType = '';

    if (activeTab === 'build') {
      // Download build logs
      if (!buildLogs || buildLogs.length === 0) {
        message.warning(
          t('prototype.vercelLogs.noLogsToDownload').replace('{type}', 'build')
        );
        return;
      }

      logType = 'build';
      filename = `build-logs-${selectedEnvironment}-${
        activeDeploymentId || 'unknown'
      }-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      content = buildLogs
        .map((log) => {
          const logText = getLogText(log);
          const timestamp = getLogTimestamp(log);
          const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
          });
          return `${timeStr} ${logText}`;
        })
        .join('\n');
    } else {
      // Download runtime logs
      if (!runtimeLogs || runtimeLogs.length === 0) {
        message.warning(
          t('prototype.vercelLogs.noLogsToDownload').replace(
            '{type}',
            'runtime'
          )
        );
        return;
      }

      logType = 'runtime';
      filename = `runtime-logs-${selectedEnvironment}-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.txt`;
      content = runtimeLogs
        .map((log) => {
          const timestamp = log.timestamp || log.created;
          const timeStr = timestamp
            ? new Date(timestamp).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
              })
            : '';

          let logLine = timeStr ? `${timeStr} ` : '';

          if (log.level) {
            logLine += `[${log.level.toUpperCase()}] `;
          }
          if (log.source) {
            logLine += `[${log.source}] `;
          }

          logLine += log.message;

          // Add metadata if available
          const logMeta = [];
          if (log.requestId) logMeta.push(`ID: ${log.requestId}`);
          if (log.statusCode) logMeta.push(`Status: ${log.statusCode}`);
          if (log.method && log.path) logMeta.push(`${log.method} ${log.path}`);

          if (logMeta.length > 0) {
            logLine += ` | ${logMeta.join(' | ')}`;
          }

          return logLine;
        })
        .join('\n');
    }

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(
      t('prototype.vercelLogs.downloaded').replace('{filename}', filename)
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff4d4f';
      case 'warning':
        return '#faad14';
      case 'info':
        return '#1890ff';
      default:
        return '#8c8c8c';
    }
  };

  const getLogText = (log: BuildLogEvent): string => {
    // Try to extract text from various possible locations
    let text = '';
    if (log.text) text = log.text;
    else if (log.payload?.text) text = log.payload.text;
    else if (log.payload?.info) text = log.payload.info;
    else text = JSON.stringify(log);

    // Filter out tech stack words
    return filterTechStackWords(text);
  };

  const getLogTimestamp = (log: BuildLogEvent): number => {
    return log.date || log.created;
  };

  const getLogClass = (logText: string): string => {
    const upperText = logText.toUpperCase();

    // Check for ERROR patterns
    if (
      upperText.includes('ERROR') ||
      upperText.includes('FAILED') ||
      upperText.includes('FAILURE') ||
      upperText.match(/\bERR\b/)
    ) {
      return 'error';
    }

    // Check for WARNING patterns
    if (upperText.includes('WARN') || upperText.includes('WARNING')) {
      return 'warn';
    }

    // Check for SUCCESS patterns
    if (
      upperText.includes('SUCCESS') ||
      upperText.includes('COMPLETED') ||
      upperText.includes('DONE')
    ) {
      return 'success';
    }

    return '';
  };

  const renderBuildLogs = () => {
    if (buildLogsLoading) {
      return (
        <div className="logs-loading">
          <Spin size="large" />
          <div style={{ color: '#d1d5db', fontSize: '14px' }}>
            Loading build logs...
          </div>
        </div>
      );
    }

    if (!buildLogs || buildLogs.length === 0) {
      return (
        <Empty
          description={
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>
              {activeDeploymentId
                ? t('prototype.vercelLogs.noBuildLogs')
                : t('prototype.vercelLogs.logsAvailableAfterDeployment')}
            </span>
          }
        />
      );
    }

    return (
      <div className="logs-container vercel-style">
        {buildLogs.map((log, index) => {
          const logText = getLogText(log);
          const timestamp = getLogTimestamp(log);
          const logClass = getLogClass(logText);

          return (
            <div
              key={index}
              className={`log-line ${logClass ? `log-${logClass}` : ''}`}
            >
              <span className="log-timestamp">
                {new Date(timestamp).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  fractionalSecondDigits: 3,
                })}{' '}
              </span>
              <span className={`log-content-text ${logClass}`}>{logText}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRuntimeLogs = () => {
    if (!productionUrl && !previewUrl) {
      return (
        <Empty
          description={
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>
              Deployment URL not available. Runtime logs require a deployment
              URL.
            </span>
          }
        />
      );
    }

    const formatLogTimestamp = (timestamp?: string | number) => {
      if (!timestamp) return '';
      try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        });
      } catch {
        return String(timestamp);
      }
    };

    return (
      <div>
        <div className="runtime-logs-toolbar">
          <div className="status-section">
            <span className="status-label">Status: </span>
            <span className={`status-value status-${streamStatus}`}>
              {streamStatus}
            </span>
          </div>
          <div className="environment-section">
            <Radio.Group
              value={selectedEnvironment}
              onChange={(e) => {
                setSelectedEnvironment(e.target.value);
                // Stop streaming when environment changes
                if (isStreaming) {
                  stopStreaming();
                }
              }}
              buttonStyle="solid"
              disabled={isStreaming}
            >
              <Radio.Button value="preview" disabled={!previewUrl}>
                Preview
              </Radio.Button>
              <Radio.Button value="production" disabled={!productionUrl}>
                Production
              </Radio.Button>
            </Radio.Group>
          </div>
          <div className="button-section">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startStreaming}
              disabled={isStreaming || !activeDeploymentUrl}
            >
              Start Monitoring
            </Button>
            <Button
              icon={<StopOutlined />}
              onClick={stopStreaming}
              disabled={!isStreaming}
            >
              Stop
            </Button>
          </div>
        </div>

        {runtimeLogs.length === 0 && !isStreaming && (
          <Empty
            description={
              <span style={{ color: '#d1d5db', fontSize: '14px' }}>
                Click 'Start Monitoring' to begin streaming runtime logs
              </span>
            }
            style={{ marginTop: 20 }}
          />
        )}

        {(runtimeLogs.length > 0 || isStreaming) && (
          <div className="logs-container vercel-style">
            {runtimeLogs.map((log, index) => {
              let logClass = '';
              if (log.level === 'error') logClass = 'error';
              else if (log.level === 'warning') logClass = 'warn';

              const logMeta = [];
              if (log.requestId) logMeta.push(`ID: ${log.requestId}`);
              if (log.statusCode) logMeta.push(`Status: ${log.statusCode}`);
              if (log.method && log.path)
                logMeta.push(`${log.method} ${log.path}`);
              if (log.source) logMeta.push(`Source: ${log.source}`);

              return (
                <div
                  key={index}
                  className={`log-line ${logClass ? `log-${logClass}` : ''}`}
                >
                  <div className="log-header">
                    <span className="log-timestamp">
                      {formatLogTimestamp(log.timestamp || log.created)}{' '}
                    </span>
                    {log.level && (
                      <span className={`log-level ${log.level}`}>
                        {log.level.toUpperCase()}
                      </span>
                    )}
                    {log.source && (
                      <span className="log-source">{log.source}</span>
                    )}
                  </div>
                  <div className={`log-content-text ${logClass}`}>
                    {log.message}
                  </div>
                  {logMeta.length > 0 && (
                    <div className="log-meta">{logMeta.join(' | ')}</div>
                  )}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingRight: '24px',
          }}
        >
          <span>Deployment Logs</span>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadLogs}
            size="small"
          >
            {t('prototype.vercelLogs.download')}
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      className="vercel-logs-modal"
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'build' | 'runtime')}
      >
        <TabPane tab="Build Logs" key="build">
          {renderBuildLogs()}
        </TabPane>
        {documentType !== DOCTYPE.PROTOTYPE && (
          <TabPane tab="Runtime Logs" key="runtime">
            {renderRuntimeLogs()}
          </TabPane>
        )}
      </Tabs>
    </Modal>
  );
};

export default VercelLogsModal;

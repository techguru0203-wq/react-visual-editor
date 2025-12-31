/**
 * Connector Types & Configuration
 * Defines types for third-party app integrations, custom APIs, and MCP servers
 */

import { RESERVED_ENV_VAR_NAMES } from '../constants';

// Re-export for easy access
export { RESERVED_ENV_VAR_NAMES };

export type ConnectorType = 'app' | 'custom_api' | 'mcp';
export type ConnectorEnvironment = 'preview' | 'production';
export type McpTransportType = 'http'; // STDIO transport not supported in this environment

// OAuth Provider Types
export type OAuthProvider =
  | 'gmail'
  | 'google_calendar'
  | 'notion'
  | 'github'
  | 'slack'
  | 'outlook'
  | 'asana'
  | 'linear'
  | 'clickup';

// Base Connector Interface
export interface BaseConnector {
  id: string;
  type: ConnectorType;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// OAuth-based App Connector
export interface AppConnectorConfig extends BaseConnector {
  type: 'app';
  provider: OAuthProvider;
  iconUrl?: string;
  // OAuth tokens (stored encrypted)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  // Connection status
  connected: boolean;
  lastSyncedAt?: string;
}

// Custom API Connector
export interface CustomApiConnectorConfig extends BaseConnector {
  type: 'custom_api';
  iconUrl?: string;
  // Environment variables to expose to LLM
  envVars: Record<string, string>; // e.g., { "API_KEY": "encrypted_value", "API_URL": "https://..." }
  // Optional API documentation
  docsUrl?: string;
}

// MCP Server Connector
export interface McpConnectorConfig extends BaseConnector {
  type: 'mcp';
  transportType: McpTransportType;
  // For HTTP transport
  serverUrl?: string;
  customHeaders?: Record<string, string>;
  // For STDIO transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // Connection status
  connected: boolean;
  lastCheckedAt?: string;
}

// Union type for all connector configs
export type ConnectorConfig =
  | AppConnectorConfig
  | CustomApiConnectorConfig
  | McpConnectorConfig;

// Document Meta Connectors Structure
export interface DocumentConnectors {
  preview: {
    connectors: ConnectorConfig[];
  };
  production: {
    connectors: ConnectorConfig[];
  };
}

// OAuth App Catalog Entry
export interface OAuthAppCatalogEntry {
  provider: OAuthProvider;
  name: string;
  description: string;
  iconUrl: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  docsUrl?: string;
}

// API Request/Response Types
export interface AddConnectorRequest {
  environment: ConnectorEnvironment;
  connector: Omit<ConnectorConfig, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface UpdateConnectorRequest {
  environment: ConnectorEnvironment;
  connector: Partial<ConnectorConfig>;
}

export interface DeleteConnectorRequest {
  environment: ConnectorEnvironment;
  connectorId: string;
}

export interface GetConnectorsResponse {
  success: boolean;
  data?: {
    preview: ConnectorConfig[];
    production: ConnectorConfig[];
  };
  errorMsg?: string;
}

export interface ConnectorOperationResponse {
  success: boolean;
  data?: ConnectorConfig;
  errorMsg?: string;
}

// OAuth Flow Types
export interface OAuthInitiateRequest {
  provider: OAuthProvider;
  documentId: string;
  environment: ConnectorEnvironment;
  redirectUri: string;
}

export interface OAuthInitiateResponse {
  success: boolean;
  data?: {
    authUrl: string;
    state: string;
  };
  errorMsg?: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
}

export interface OAuthCallbackResponse {
  success: boolean;
  data?: {
    connector: AppConnectorConfig;
  };
  errorMsg?: string;
}

// MCP Tool Types
export interface McpTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
}

export interface McpListToolsResponse {
  tools: McpTool[];
}

export interface McpInvokeToolRequest {
  toolName: string;
  arguments: Record<string, any>;
}

export interface McpInvokeToolResponse {
  success: boolean;
  result?: any;
  error?: string;
}

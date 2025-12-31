/**
 * Connector Service
 * Handles connector CRUD operations
 */

import crypto from 'crypto';
import prisma from '../db/prisma';
import { encryptEnvVars, decryptEnvVars } from '../lib/encryption';
import {
  ConnectorConfig,
  CustomApiConnectorConfig,
  McpConnectorConfig,
  ConnectorEnvironment,
  RESERVED_ENV_VAR_NAMES,
} from '../../shared/types/connectorTypes';
import { Prisma } from '@prisma/client';
import { updateDocumentMeta } from './documentMetaService';

/**
 * Get connectors for a document
 */
export async function getConnectorsForDocument(
  documentId: string,
  environment?: ConnectorEnvironment
): Promise<{ preview: ConnectorConfig[]; production: ConnectorConfig[] }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { meta: true },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const meta = document.meta as Prisma.JsonObject;
  const connectors = meta?.connectors as any;

  if (!connectors) {
    return { preview: [], production: [] };
  }

  // Decrypt sensitive fields
  const decryptConnector = (connector: ConnectorConfig): ConnectorConfig => {
    if (connector.type === 'custom_api') {
      const apiConnector = connector as CustomApiConnectorConfig;
      return {
        ...apiConnector,
        envVars: decryptEnvVars(apiConnector.envVars),
      };
    } else if (connector.type === 'mcp') {
      const mcpConnector = connector as McpConnectorConfig;
      if (mcpConnector.customHeaders || mcpConnector.env) {
        return {
          ...mcpConnector,
          customHeaders: mcpConnector.customHeaders
            ? decryptEnvVars(mcpConnector.customHeaders)
            : undefined,
          env: mcpConnector.env ? decryptEnvVars(mcpConnector.env) : undefined,
        };
      }
    }
    return connector;
  };

  const preview = (connectors.preview?.connectors || []).map(decryptConnector);
  const production = (connectors.production?.connectors || []).map(
    decryptConnector
  );

  if (environment) {
    return environment === 'preview'
      ? { preview, production: [] }
      : { preview: [], production };
  }

  return { preview, production };
}

/**
 * Add connector to document
 */
export async function addConnectorToDocument(
  documentId: string,
  environment: ConnectorEnvironment,
  connector: Omit<ConnectorConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConnectorConfig> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { meta: true },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Validate custom_api connector - check for reserved env var names
  if (connector.type === 'custom_api') {
    const apiConnector = connector as CustomApiConnectorConfig;
    const reservedVarFound = Object.keys(apiConnector.envVars).find((key) =>
      RESERVED_ENV_VAR_NAMES.includes(key as any)
    );
    if (reservedVarFound) {
      throw new Error(
        `Environment variable name '${reservedVarFound}' is reserved by the system. Please use a different name.`
      );
    }
  }

  // Validate MCP connector - only HTTP transport is supported
  if (connector.type === 'mcp') {
    const mcpConnector = connector as McpConnectorConfig;
    if (mcpConnector.transportType !== 'http') {
      throw new Error('Only HTTP transport is supported for MCP connectors');
    }
    if (!mcpConnector.serverUrl) {
      throw new Error('Server URL is required for HTTP transport');
    }
  }

  // Generate ID and timestamps
  const newConnector: ConnectorConfig = {
    ...connector,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ConnectorConfig;

  // Encrypt sensitive fields
  const encryptedConnector = encryptConnectorFields(newConnector);

  // Get current connectors
  const meta = (document.meta as Prisma.JsonObject) || {};
  const connectors = (meta.connectors as any) || {
    preview: { connectors: [] },
    production: { connectors: [] },
  };

  connectors[environment] = connectors[environment] || { connectors: [] };
  connectors[environment].connectors = [
    ...(connectors[environment].connectors || []),
    encryptedConnector,
  ];

  // Use updateDocumentMeta to update the entire connectors object
  try {
    await updateDocumentMeta(documentId, { connectors });
  } catch (error) {
    console.error(
      `[ConnectorService] Failed to add connector to document ${documentId}:`,
      error
    );
    throw new Error('Failed to save connector to document');
  }

  return newConnector;
}

/**
 * Update connector in document
 */
export async function updateConnectorInDocument(
  documentId: string,
  environment: ConnectorEnvironment,
  connectorId: string,
  updates: Partial<ConnectorConfig>
): Promise<ConnectorConfig> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { meta: true },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const meta = (document.meta as Prisma.JsonObject) || {};
  const connectors = (meta.connectors as any) || {
    preview: { connectors: [] },
    production: { connectors: [] },
  };

  const envConnectors = connectors[environment]?.connectors || [];
  const connectorIndex = envConnectors.findIndex(
    (c: ConnectorConfig) => c.id === connectorId
  );

  if (connectorIndex === -1) {
    throw new Error('Connector not found');
  }

  // Decrypt existing connector for merging
  const existingConnector = decryptConnectorFields(
    envConnectors[connectorIndex]
  );

  // Merge updates (preserve discriminated union type)
  const updatedConnector = {
    ...existingConnector,
    ...updates,
    id: connectorId, // Preserve ID
    updatedAt: new Date().toISOString(),
  } as ConnectorConfig;

  // Validate custom_api connector - check for reserved env var names
  if (updatedConnector.type === 'custom_api') {
    const apiConnector = updatedConnector as CustomApiConnectorConfig;
    const reservedVarFound = Object.keys(apiConnector.envVars).find((key) =>
      RESERVED_ENV_VAR_NAMES.includes(key as any)
    );
    if (reservedVarFound) {
      throw new Error(
        `Environment variable name '${reservedVarFound}' is reserved by the system. Please use a different name.`
      );
    }
  }

  // Validate MCP connector - only HTTP transport is supported
  if (updatedConnector.type === 'mcp') {
    const mcpConnector = updatedConnector as McpConnectorConfig;
    if (mcpConnector.transportType !== 'http') {
      throw new Error('Only HTTP transport is supported for MCP connectors');
    }
    if (!mcpConnector.serverUrl) {
      throw new Error('Server URL is required for HTTP transport');
    }
  }

  // Encrypt and save
  const encryptedConnector = encryptConnectorFields(updatedConnector);
  envConnectors[connectorIndex] = encryptedConnector;

  connectors[environment].connectors = envConnectors;

  try {
    await updateDocumentMeta(documentId, { connectors });
  } catch (error) {
    console.error(
      `[ConnectorService] Failed to update connector in document ${documentId}:`,
      error
    );
    throw new Error('Failed to update connector in document');
  }

  return updatedConnector;
}

/**
 * Delete connector from document
 */
export async function deleteConnectorFromDocument(
  documentId: string,
  environment: ConnectorEnvironment,
  connectorId: string
): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { meta: true },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const meta = (document.meta as Prisma.JsonObject) || {};
  const connectors = (meta.connectors as any) || {
    preview: { connectors: [] },
    production: { connectors: [] },
  };

  const envConnectors = connectors[environment]?.connectors || [];
  const updatedConnectors = envConnectors.filter(
    (c: ConnectorConfig) => c.id !== connectorId
  );

  connectors[environment].connectors = updatedConnectors;

  // Use updateDocumentMeta to update the entire connectors object
  try {
    await updateDocumentMeta(documentId, { connectors });
  } catch (error) {
    console.error(
      `[ConnectorService] Failed to delete connector from document ${documentId}:`,
      error
    );
    throw new Error('Failed to delete connector from document');
  }
}

/**
 * Encrypt sensitive fields in connector
 */
function encryptConnectorFields(connector: ConnectorConfig): ConnectorConfig {
  if (connector.type === 'custom_api') {
    const apiConnector = connector as CustomApiConnectorConfig;
    return {
      ...apiConnector,
      envVars: encryptEnvVars(apiConnector.envVars),
    };
  } else if (connector.type === 'mcp') {
    const mcpConnector = connector as McpConnectorConfig;
    return {
      ...mcpConnector,
      customHeaders: mcpConnector.customHeaders
        ? encryptEnvVars(mcpConnector.customHeaders)
        : undefined,
      env: mcpConnector.env ? encryptEnvVars(mcpConnector.env) : undefined,
    };
  }
  return connector;
}

/**
 * Decrypt sensitive fields in connector
 */
function decryptConnectorFields(connector: ConnectorConfig): ConnectorConfig {
  if (connector.type === 'custom_api') {
    const apiConnector = connector as CustomApiConnectorConfig;
    return {
      ...apiConnector,
      envVars: decryptEnvVars(apiConnector.envVars),
    };
  } else if (connector.type === 'mcp') {
    const mcpConnector = connector as McpConnectorConfig;
    return {
      ...mcpConnector,
      customHeaders: mcpConnector.customHeaders
        ? decryptEnvVars(mcpConnector.customHeaders)
        : undefined,
      env: mcpConnector.env ? decryptEnvVars(mcpConnector.env) : undefined,
    };
  }
  return connector;
}

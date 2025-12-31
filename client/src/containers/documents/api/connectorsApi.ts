/**
 * Connectors API Client
 * Frontend API functions for connector management
 */

import { getHeaders } from '../../../common/util/apiHeaders';
import {
  ConnectorConfig,
  ConnectorEnvironment,
  OAuthAppCatalogEntry,
  OAuthProvider,
} from '../../../shared/types/connectorTypes';
import { api_url } from '../../../lib/constants';

/**
 * Get OAuth app catalog
 */
export async function getOAuthAppCatalogApi(): Promise<OAuthAppCatalogEntry[]> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/connectors/app-catalog`, {
    method: 'GET',
    headers,
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to fetch OAuth app catalog');
}

/**
 * Get connectors for a document
 */
export async function getConnectorsApi(
  documentId: string,
  environment?: ConnectorEnvironment
): Promise<{ preview: ConnectorConfig[]; production: ConnectorConfig[] }> {
  const headers = await getHeaders();
  const url = environment
    ? `${api_url}/api/connectors/${documentId}?environment=${environment}`
    : `${api_url}/api/connectors/${documentId}`;

  const result = await fetch(url, {
    method: 'GET',
    headers,
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to fetch connectors');
}

/**
 * Add a connector to a document
 */
export async function addConnectorApi(
  documentId: string,
  environment: ConnectorEnvironment,
  connector: Omit<ConnectorConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConnectorConfig> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/connectors/${documentId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ environment, connector }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to add connector');
}

/**
 * Update a connector
 */
export async function updateConnectorApi(
  documentId: string,
  connectorId: string,
  environment: ConnectorEnvironment,
  connector: Partial<ConnectorConfig>
): Promise<ConnectorConfig> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/connectors/${documentId}/${connectorId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ environment, connector }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to update connector');
}

/**
 * Delete a connector
 */
export async function deleteConnectorApi(
  documentId: string,
  connectorId: string,
  environment: ConnectorEnvironment
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/connectors/${documentId}/${connectorId}?environment=${environment}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to delete connector');
  }
}

/**
 * Initiate OAuth flow
 */
export async function initiateOAuthApi(
  provider: OAuthProvider,
  documentId: string,
  environment: ConnectorEnvironment
): Promise<{ authUrl: string; state: string }> {
  const headers = await getHeaders();
  const redirectUri = `${window.location.origin}/api/connectors/oauth/callback/${provider}`;

  const result = await fetch(`${api_url}/api/connectors/oauth/initiate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider, documentId, environment, redirectUri }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to initiate OAuth flow');
}

/**
 * Refresh OAuth token
 */
export async function refreshOAuthTokenApi(
  documentId: string,
  connectorId: string,
  environment: ConnectorEnvironment
): Promise<ConnectorConfig> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/connectors/oauth/refresh/${documentId}/${connectorId}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ environment }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to refresh OAuth token');
}

/**
 * Test connector connection
 */
export async function testConnectorApi(
  documentId: string,
  connectorId: string,
  environment: ConnectorEnvironment
): Promise<{ success: boolean; message: string }> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/connectors/test/${documentId}/${connectorId}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ environment }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  }
  throw new Error(errorMsg || 'Failed to test connector');
}

/**
 * Sync connector environment variables to Vercel
 */
export async function syncConnectorEnvVarsToVercelApi(
  documentId: string,
  deployDocId: string,
  envVars: Record<string, string>,
  environment: ConnectorEnvironment
): Promise<void> {
  const headers = await getHeaders();

  const target =
    environment === 'production' ? ['production'] : ['preview', 'development'];

  const envVarsArray = Object.entries(envVars).map(([key, value]) => ({
    key,
    value,
    type: 'plain',
    target,
  }));

  const result = await fetch(`${api_url}/api/vercel/env-vars`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      deployDocId,
      envVars: envVarsArray,
    }),
  });

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(
      errorMsg || 'Failed to sync environment variables to Vercel'
    );
  }
}

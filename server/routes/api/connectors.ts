/**
 * Connectors API Routes
 * Handles connector CRUD operations
 */

import { Router } from 'express';
import {
  getConnectorsForDocument,
  addConnectorToDocument,
  updateConnectorInDocument,
  deleteConnectorFromDocument,
} from '../../services/connectorService';
import {
  ConnectorEnvironment,
  McpConnectorConfig,
} from '../../../shared/types/connectorTypes';
import { AuthenticatedResponse } from '../../types/response';
import { mcpConnectorService } from '../../services/mcpConnectorService';

const router = Router();

/**
 * GET /api/connectors/:documentId
 * Get all connectors for a document
 */
router.get(
  '/:documentId',
  async (request, response: AuthenticatedResponse<any>) => {
    try {
      const { documentId } = request.params;
      const environment = request.query.environment as
        | ConnectorEnvironment
        | undefined;

      const connectors = await getConnectorsForDocument(
        documentId,
        environment
      );

      return response.status(200).json({
        success: true,
        data: connectors,
      });
    } catch (error: any) {
      console.error('[Connectors] Failed to get connectors:', error);
      return response.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to get connectors',
      });
    }
  }
);

/**
 * POST /api/connectors/:documentId
 * Add a new connector
 */
router.post(
  '/:documentId',
  async (request, response: AuthenticatedResponse<any>) => {
    try {
      const { documentId } = request.params;
      const { environment, connector } = request.body;

      if (!environment || !connector) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Missing required fields: environment, connector',
        });
      }

      const newConnector = await addConnectorToDocument(
        documentId,
        environment,
        connector
      );

      return response.status(200).json({
        success: true,
        data: newConnector,
      });
    } catch (error: any) {
      console.error('[Connectors] Failed to add connector:', error);
      return response.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to add connector',
      });
    }
  }
);

/**
 * PUT /api/connectors/:documentId/:connectorId
 * Update a connector
 */
router.put(
  '/:documentId/:connectorId',
  async (request, response: AuthenticatedResponse<any>) => {
    try {
      const { documentId, connectorId } = request.params;
      const { environment, connector } = request.body;

      if (!environment) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Missing required field: environment',
        });
      }

      const updatedConnector = await updateConnectorInDocument(
        documentId,
        environment,
        connectorId,
        connector
      );

      return response.status(200).json({
        success: true,
        data: updatedConnector,
      });
    } catch (error: any) {
      console.error('[Connectors] Failed to update connector:', error);
      return response.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to update connector',
      });
    }
  }
);

/**
 * DELETE /api/connectors/:documentId/:connectorId
 * Delete a connector
 */
router.delete(
  '/:documentId/:connectorId',
  async (request, response: AuthenticatedResponse<any>) => {
    try {
      const { documentId, connectorId } = request.params;
      const environment = request.query.environment as ConnectorEnvironment;

      if (!environment) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Missing required query parameter: environment',
        });
      }

      await deleteConnectorFromDocument(documentId, environment, connectorId);

      return response.status(200).json({
        success: true,
      });
    } catch (error: any) {
      console.error('[Connectors] Failed to delete connector:', error);
      return response.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to delete connector',
      });
    }
  }
);

/**
 * POST /api/connectors/test/:documentId/:connectorId
 * Test connector connection
 */
router.post(
  '/test/:documentId/:connectorId',
  async (request, response: AuthenticatedResponse<any>) => {
    try {
      const { documentId, connectorId } = request.params;
      const { environment } = request.body;

      if (!environment) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Missing required field: environment',
        });
      }

      // Get connector
      const connectors = await getConnectorsForDocument(
        documentId,
        environment
      );
      const envConnectors =
        environment === 'preview' ? connectors.preview : connectors.production;
      const connector = envConnectors.find((c) => c.id === connectorId);

      if (!connector) {
        return response.status(404).json({
          success: false,
          errorMsg: 'Connector not found',
        });
      }

      // Test connection based on connector type
      let testResult = {
        success: false,
        message: 'Connection test not implemented for this connector type',
      };

      if (connector.type === 'mcp') {
        testResult = await mcpConnectorService.testConnection(
          connector as McpConnectorConfig
        );
      } else if (connector.type === 'custom_api') {
        // TODO: Implement Custom API test
        testResult = {
          success: false,
          message: 'Custom API connection test not yet implemented',
        };
      }

      return response.status(200).json({
        success: true,
        data: testResult,
      });
    } catch (error: any) {
      console.error('[Connectors] Failed to test connector:', error);
      return response.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to test connector',
      });
    }
  }
);

export const className = 'connectors';
export const routes = router;

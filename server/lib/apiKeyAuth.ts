import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/apiKeyService';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    organizationId: string;
  };
}

/**
 * Middleware to validate API keys for external API access
 * This is used for the /v1/* endpoints that external users will call
 */
export const apiKeyAuthMiddleware = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message:
          'Please provide an API key in the Authorization header as "Bearer <your-api-key>"',
      });
    }

    const [tokenType, apiKey, ...otherParts] = authHeader.split(' ');

    if (otherParts.length !== 0 || tokenType !== 'Bearer' || !apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format',
        message:
          'Authorization header must be in the format "Bearer <your-api-key>"',
      });
    }

    // Validate the API key
    const validation = await validateApiKey(apiKey);

    if (!validation.isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been deactivated',
      });
    }

    // Attach API key info to request for use in route handlers
    req.apiKey = {
      organizationId: validation.organizationId!,
    };

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while validating your API key',
    });
  }
};

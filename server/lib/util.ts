import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { RequestHandler } from 'express';
import prisma from '../db/prisma';
import {
  AuthenticatedUser,
  AuthenticatedUserWithProfile,
} from '../types/authTypes';
import { RedisSingleton } from '../services/redis/redis';
import { REDIS_PREFIX_JIRA } from '../services/jiraService';
import { SubscriptionTier } from '@prisma/client';
import { SpecialtyToIssueType } from '../../shared/constants';
import {
  CreditAmountMapping,
  CREDITS_FOR_SUBSCRIPTION,
  LANGUAGES,
} from './constant';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.REACT_APP_USER_POOL_ID as string,
  clientId: process.env.REACT_APP_USER_POOL_CLIENT_ID as string,
  tokenUse: 'access',
});

export const authenticatedRequestHandler: RequestHandler = async (
  request,
  response,
  next
) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    if (
      request.originalUrl.indexOf('/api/documents/shared') !== -1 &&
      request.method === 'GET'
    ) {
      // TODO: use passCode, replace email
      next();
      return;
    }
    console.error(
      'server.lib.utils.authenticatedRequestHandler.error: No token was found in these headers: ' +
        JSON.stringify(Object.keys(request.headers))
    );
    response
      .status(403)
      .json({ success: false, errorMsg: 'Permission denied.' });
    return;
  }

  const [tokenType, accessToken, ...otherParts] = authHeader.split(' ');
  if (otherParts.length !== 0 || tokenType !== 'Bearer') {
    console.error(
      'server.lib.utils.authenticatedRequestHandler: Incorrectly formatted authorization header'
    );
    response
      .status(403)
      .json({ success: false, errorMsg: 'Permission denied.' });
    return;
  }

  try {
    const payload = await verifier.verify(accessToken);
    const user: AuthenticatedUser = {
      userId: payload.sub,
      userName: payload.username,
    };
    response.locals.currentUser = user;
    next();
  } catch (error) {
    console.error(
      'server.lib.utils.authenticatedRequestHandler: An error occurred while validating an access token',
      {
        error,
      }
    );
    response
      .status(403)
      .json({ success: false, errorMsg: 'Permission denied.' });
  }
};

export const callbackRequestHandler: RequestHandler = async (
  request,
  response,
  next
) => {
  const nonce = request.query.state as string;
  console.log('Callback request, nonce = ', nonce);
  const userId = await RedisSingleton.getData(REDIS_PREFIX_JIRA + nonce);
  if (userId) {
    console.log('Authentication passed for callback request.');
    const user: AuthenticatedUser = {
      userId: userId,
      userName: '',
    };
    response.locals.currentUser = user;
    RedisSingleton.clearData(REDIS_PREFIX_JIRA + nonce);
    next();
  } else {
    console.error(
      'server.lib.utils.callbackRequestHandler: Invalid nonce for callback request.'
    );
    response.status(500).json({
      success: false,
      errorMsg: 'Invalid credential for callback request.',
    });
  }
};

export const userProfileRequestHandler: RequestHandler = async (
  request,
  response,
  next
) => {
  const currentUser = response.locals.currentUser;
  if (!currentUser) {
    if (
      request.originalUrl.indexOf('/api/documents/shared') !== -1 &&
      request.method === 'GET'
    ) {
      // TODO: use passCode, replace email
      next();
      return;
    }
    console.error(
      'server.lib.utils.userProfileRequestHandler: The currentUser is not available'
    );
    response.status(500).json({
      success: false,
      errorMsg: 'currentUser not available on server',
    });
    return;
  }

  // const userProfile = userProfileCache[currentUser.userId] || await prisma.user.findUnique({
  //   where: { id: currentUser.userId },
  //   select: { organizationId: true, email: true }, // Only get the new fields we need for most use cases
  // });

  const userProfile = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: {
      organizationId: true,
      email: true,
      role: true,
      firstname: true,
      lastname: true,
      meta: true, // Include meta field for Bitbucket/GitHub profiles
      subscriptionTier: true, // Include subscriptionTier field for Tier info in the generated app
      subscriptionStatus: true,
    },
  });

  if (!userProfile) {
    console.error(
      'server.lib.utils.userProfileRequestHandler: No profile exists for use = ' +
        currentUser.userId
    );
    response.status(404).json({
      success: false,
      errorMsg: 'This user does not have a profile yet',
    });
    return;
  }

  // userProfileCache[currentUser.userId] = userProfile;

  const updatedCurrentUser: AuthenticatedUserWithProfile = {
    ...currentUser,
    ...userProfile,
  };

  response.locals.currentUser = updatedCurrentUser;

  next();
};

export function getTierFromPrice(description: string): SubscriptionTier {
  const desc = description.toLowerCase();
  if (desc.includes('essential')) {
    return SubscriptionTier.STARTER;
  } else if (desc.includes('premium')) {
    return SubscriptionTier.PRO;
  } else if (desc.includes('scale')) {
    return SubscriptionTier.BUSINESS;
  } else if (desc.includes('enterprise')) {
    return SubscriptionTier.ENTERPRISE;
  } else {
    return SubscriptionTier.FREE;
  }
  throw new Error('Tier not found for subscription price: ' + description);
}

export function getSeatNumberForTier(tier: string) {
  switch (tier) {
    case 'FREE':
      return 1;
    case 'STARTER':
      return 1;
    case 'PRO':
      return 20;
    case 'BUSINESS':
      return 100;
    default:
      return 1; // Default to 1 seat if the tier is unknown
  }
}

export function getCreditAmount(amount: number) {
  let key = amount + '';
  if (!CreditAmountMapping[key]) {
    throw new Error(
      'Payment amount received not found for credit purchase: ' + amount
    );
    return;
  }
  return CreditAmountMapping[key];
}

export function getCreditsForSubscription(
  subscriptionTier: string,
  planInterval: string
): number {
  const interval =
    planInterval.toLowerCase() === 'month' ? 'MONTHLY' : 'YEARLY';
  return CREDITS_FOR_SUBSCRIPTION[interval][subscriptionTier];
}

export function getTaskTypeFromSpecialtyName(specialty: string): string {
  if (specialty === 'FULLSTACK_ENGINEER') {
    // swap out fullstack with frontend and backend
    return 'Frontend,Backend';
  }
  let result = SpecialtyToIssueType[specialty];
  if (!result) {
    result = specialty
      .replace('_', ' ')
      .toLowerCase()
      .replace(/engineer(s)?/g, '');
    // write regex to capitalize first letter of each word from result above
    result = result.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return result;
}

export function getLanguageNameFromCode(code: string) {
  let language = LANGUAGES.find((lang) => lang.code === code)?.name;
  return language || 'English';
}

export function isEmail(email: string): boolean {
  var pattern = /^([A-Za-z0-9_\-\.\+])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
  return pattern.test(email);
}

export function extractJsonObject(str: string | any) {
  // If input is not a string, return it directly (e.g., tool call responses are already objects)
  if (typeof str !== 'string') {
    console.log(
      'server.lib.util.extractJsonObject: input is not a string, returning as-is:',
      typeof str
    );
    return str;
  }

  // Helper function to strip special characters from message content
  const stripSpecialCharsFromMessage = (message: string): string => {
    // Replace Chinese quotation marks with regular quotes
    let cleaned = message
      .replace(/"/g, '"') // Left double quotation mark
      .replace(/"/g, '"') // Right double quotation mark
      .replace(/'/g, "'") // Left single quotation mark
      .replace(/'/g, "'"); // Right single quotation mark

    // Remove control characters (except newlines, tabs, carriage returns)
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');

    return cleaned;
  };

  // Helper function to extract intent and message from string when JSON parsing fails
  const extractIntentAndMessage = (
    jsonStr: string
  ): { intent: string; message: string } | null => {
    // Try to extract intent (case-insensitive)
    const intentMatch = jsonStr.match(/"intent"\s*:\s*"([^"]+)"/i);
    const intent = intentMatch ? intentMatch[1].toUpperCase() : 'REPLY';

    // Try to extract message - handle both escaped and unescaped quotes
    // First try to match message with proper JSON escaping
    let messageMatch = jsonStr.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/i);

    // If that fails, try a more lenient match that handles unescaped quotes
    if (!messageMatch) {
      // Find the message value by looking for content between "message": " and the next " or }
      messageMatch = jsonStr.match(/"message"\s*:\s*"([^"]*(?:"[^,}\]]*)*)"/i);
    }

    // If still no match, try to extract everything after "message": " until we hit a pattern
    if (!messageMatch) {
      const messageStart = jsonStr.search(/"message"\s*:\s*"/i);
      if (messageStart >= 0) {
        const afterColon = jsonStr.substring(messageStart);
        // Try to find where the message ends (look for ", or "} or end of string)
        const endMatch = afterColon.match(/^[^"]*"([^"]*)"\s*[,}]/);
        if (endMatch) {
          messageMatch = endMatch;
        } else {
          // Extract everything after the opening quote until a closing quote followed by comma or brace
          const contentMatch = afterColon.match(
            /^[^"]*"([^"]*(?:"[^,}\]]*)*)"/
          );
          if (contentMatch) {
            messageMatch = contentMatch;
          }
        }
      }
    }

    if (messageMatch && messageMatch[1]) {
      // Unescape the message
      let message = messageMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');

      // Strip special characters from the message
      message = stripSpecialCharsFromMessage(message);

      return { intent, message };
    }

    return null;
  };

  // First try to parse as raw JSON
  try {
    return JSON.parse(str);
  } catch (e) {
    // If that fails, try to extract from markdown code blocks
    const regex = /```(?:json)?\n?([\s\S]*?)\n?```/;
    const match = str.match(regex);
    const jsonContent = match ? match[1] : str;

    try {
      return JSON.parse(jsonContent);
    } catch (e2) {
      // If parsing still fails, try to extract intent and message manually
      const extracted = extractIntentAndMessage(jsonContent);
      if (extracted) {
        console.log(
          'server.lib.util.extractJsonObject: Extracted intent and message after parsing failure',
          { intent: extracted.intent, messageLength: extracted.message.length }
        );
        return extracted;
      }

      // Last resort: try to find JSON object in the string
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
          // Try extraction from the matched JSON
          const extracted = extractIntentAndMessage(jsonMatch[0]);
          if (extracted) {
            return extracted;
          }
        }
      }

      // All attempts failed
      return null;
    }
  }
}
// Add this tool to the server/lib/util.ts file for backend use. There is same function in client/src/common/util/vercelUtils.ts
export function generateDeployDocId(
  docName: string,
  docType: string,
  documentId: string
): string {
  const isAsciiOnly = /^[\x00-\x7F]*$/.test(docName); // Check if the document name contains only ASCII characters
  const namePart = isAsciiOnly
    ? docName.split(' - ').pop()?.replace(/\s/g, '') || ''
    : ''; // If not ASCII, we don't include the name part in the ID
  return `${namePart ? namePart + '-' : ''}${docType.substring(
    0,
    4
  )}-${documentId.substring(0, 12)}`.toLowerCase();
}

/**
 * Normalizes environment settings to handle both old (flat) and new (preview/production) structures
 * @param envSettings The environment settings object from document.meta.envSettings
 * @param environment The target environment ('preview' or 'production'), defaults to 'preview'
 * @returns A flat object with environment variables
 */
export function normalizeEnvSettings(
  envSettings: any,
  environment: 'production' | 'preview' | 'development' = 'preview'
): Record<string, string> {
  if (!envSettings || typeof envSettings !== 'object') {
    return {};
  }

  // Check if using new structure (has preview or production keys)
  if (envSettings.preview || envSettings.production) {
    const targetEnv = envSettings[environment] || {};
    return targetEnv;
  }

  // Old structure: flat key-value pairs (treat as preview)
  if (environment === 'preview') {
    return envSettings;
  } else {
    return {};
  }
}

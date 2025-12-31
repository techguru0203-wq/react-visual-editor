import { Router } from 'express';
import { AuthenticatedResponse } from '../../types/response';
import { v4 as uuidv4 } from 'uuid';
import {
  generateAuthorizationURL,
  NONCE_TTL_IN_SEC,
  REDIS_PREFIX_JIRA,
} from '../../services/jiraService';
import { RedisSingleton } from '../../services/redis/redis';

const router = Router();

router.get(
  '/jira',
  async function (request, response: AuthenticatedResponse<string>) {
    const nonce = uuidv4();
    let currentUser = response.locals.currentUser;

    const key = nonce;
    const value = currentUser.userId;

    try {
      // Store (nonce, userId) mapping in Redis.
      await RedisSingleton.setData({
        key: REDIS_PREFIX_JIRA + key,
        val: value,
        expireInSec: NONCE_TTL_IN_SEC,
      });
    } catch (error) {
      response.status(500).json({
        success: false,
        errorMsg:
          'Internal Server Error:: failed to cache nonce for Jira in Redis.',
      });
      return;
    }

    // Return the authorization URL to Jira.
    response.status(200).json({
      success: true,
      data: generateAuthorizationURL(nonce),
    });
  }
);

export const className = 'authorize';
export const routes = router;

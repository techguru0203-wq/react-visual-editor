import { Router } from 'express';
import { AuthenticatedResponse } from '../../types/response';
import {
  exchangeAccessAndRefreshTokens,
  fetchJiraUserProfile,
  getJiraResource,
} from '../../services/jiraService';
import { CLIENT_BASE_URL } from '../../../shared/constants';
import {
  saveJiraUserInformation,
  saveJiraResource,
} from '../../services/userService';

const router = Router();

router.get(
  '/jira',
  async function (request, response: AuthenticatedResponse<string>) {
    const userUuid = response.locals.currentUser.userId;
    const code = request.query.code;

    if (!code) {
      response.status(500).json({
        success: false,
        errorMsg: 'Jira access code not found!',
      });
      return;
    }
    const tokens = await exchangeAccessAndRefreshTokens(code.toString());
    const userProfile = await fetchJiraUserProfile(tokens.access_token);
    await saveJiraUserInformation(userUuid, tokens, userProfile);
    const jiraResources = await getJiraResource(userUuid);

    if (jiraResources.length > 1) {
      console.log('Multiple resources found for user: ', jiraResources);
    }
    if (jiraResources.length > 0) {
      console.log("Save Jira resource to user's profile: ", jiraResources[0]);
      await saveJiraResource(userUuid, jiraResources[0]);
    }

    response.redirect(CLIENT_BASE_URL + '/settings/admin');
  }
);

export const className = 'callback';
export const routes = router;

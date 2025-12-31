import { Router } from 'express';
import express from 'express';

import { StandardResponse } from '../../types/response';
import {
  handleCommentEvent,
  handleIssueEvent,
  handleProjectEvent,
  handleSprintEvent,
  handleWorkLogEvent,
} from './handlers/jiraEventHandler';
import {
  CommentEvent,
  IssueEvent,
  ProjectEvent,
  SprintEvent,
  WorkLogEvent,
} from '../types/jiraTypes';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async function (request, response: StandardResponse<string>) {
    const jsonBody = JSON.parse(request.body);
    if (Object.values(IssueEvent).includes(jsonBody.webhookEvent)) {
      handleIssueEvent(jsonBody, response, jsonBody.webhookEvent);
    }
    if (Object.values(CommentEvent).includes(jsonBody.webhookEvent)) {
      handleCommentEvent(jsonBody, jsonBody.webhookEvent);
    }
    if (Object.values(WorkLogEvent).includes(jsonBody.webhookEvent)) {
      handleWorkLogEvent(jsonBody, jsonBody.webhookEvent);
    }
    if (Object.values(ProjectEvent).includes(jsonBody.webhookEvent)) {
      handleProjectEvent(jsonBody, jsonBody.webhookEvent);
    }
    if (Object.values(SprintEvent).includes(jsonBody.webhookEvent)) {
      handleSprintEvent(jsonBody, jsonBody.webhookEvent);
    }
    response.status(200).json({
      success: true,
      data: `Webhook received and processed.`,
    });
  }
);

export const className = 'jira';
export const routes = router;

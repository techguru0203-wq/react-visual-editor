import { Express } from 'express';
import express from 'express';
import { apiKeyAuthMiddleware } from '../../../lib/apiKeyAuth';

var routers = function (app: Express) {
  // Load v1 API routes
  const chatRouter = require('./chat');
  const speechRouter = require('./speech');

  // Apply API key authentication and usage logging to all v1 routes
  app.use(
    '/api/v1',
    express.json({ limit: '10mb' }),
    apiKeyAuthMiddleware,
    chatRouter.routes,
    speechRouter.routes
  );
};

module.exports = routers;

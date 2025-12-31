import { Express } from 'express';
import express from 'express';
import * as fs from 'fs';
import {
  authenticatedRequestHandler,
  callbackRequestHandler,
  userProfileRequestHandler,
} from '../../lib/util';

var routers = function (app: Express) {
  fs.readdirSync(__dirname)
    .filter(function (file) {
      return (
        file.indexOf('.') !== 0 &&
        file !== 'index.ts' &&
        file !== 'callback.ts' &&
        file !== 'v1' // Skip v1 directory, handle it separately
      );
    })
    .forEach(function (name) {
      var router = require(__dirname + '/' + name);

      if (
        router.className == 'signup' ||
        router.className == 'pub' ||
        router.className == 'support'
      ) {
        app.use('/api/' + router.className, express.json(), router.routes);
      } else {
        app.use(
          '/api/' + router.className,
          express.json({ limit: '150mb' }),
          authenticatedRequestHandler,
          userProfileRequestHandler,
          router.routes
        );
      }
    });

  // For callback requests, we'll authenticate via nonce.
  app.use(
    '/api/callback',
    express.json(),
    callbackRequestHandler,
    require(__dirname + '/callback').routes
  );

  // Load v1 API routes (external API with API key authentication)
  require('./v1')(app);
};

module.exports = routers;

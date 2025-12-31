import { Express } from 'express';

export const routes = function (app: Express) {
  // init api end points routes
  require('./webhook')(app);
  require('./api')(app);
};

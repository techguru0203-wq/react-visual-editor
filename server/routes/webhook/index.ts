import { Express } from 'express';
import * as fs from 'fs';

var routers = function (app: Express) {
  // For webhook requests, we will pass through request to handler

  fs.readdirSync(__dirname)
    .filter(function (file) {
      return (
        file.indexOf('.') !== 0 && file !== 'index.ts' && file.endsWith('.ts')
      );
    })
    .forEach(function (name) {
      var router = require(__dirname + '/' + name);
      app.use('/webhook/' + router.className, router.routes);
    });

  console.log(app.routes);
};

module.exports = routers;

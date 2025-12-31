import './server/bootstrap';
import sslRedirect from 'heroku-ssl-redirect';
import { AddressInfo } from 'net';
import bodyParser from 'body-parser';
import { corsOptions } from './server/lib/constant';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import timeout from 'connect-timeout';
import { routes } from './server/routes';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { runScheduledTasks } from './server/services/emailService';
import { fileProcessingQueue } from './server/services/fileProcessingQueue';
import { initializeDevServerCleanup, cleanupAllDevServers } from './server/services/devServerManager';

// read in process config values from env var for dev
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Create an express instance
var app = express();

// enable ssl redirect
app.use(sslRedirect());

app.use(timeout('300s'));

// add request logging
app.use(morgan('tiny'));

// trust first proxy
app.set('trust proxy', 1);

// enable cors
app.use(cors(corsOptions));

app.use(bodyParser.urlencoded({ extended: true, limit: '150mb' }));

// init all app routes
routes(app);

// check user status every 24 Hours then after send email
cron.schedule('0 0 * * *', runScheduledTasks);

// Clean old Bull queue jobs every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    await fileProcessingQueue.cleanOldJobs();
  } catch (error) {
    console.error('Error cleaning old queue jobs:', error);
  }
});

// finally, default to index.html
app.use(express.static(__dirname + '/client/build'));
app.get('/*', function (req, res) {
  const indexFile = path.join(__dirname, 'client/build/index.html');
  res.sendFile(indexFile);
});

// Start our server
var server = app.listen(process.env.PORT || 3000, async function () {
  let serverAddress = server.address() as AddressInfo;
  console.log(
    'Express server listening on port ' + serverAddress.port,
    process.env.NODE_ENV
  );
  console.log('🚀 File processing queue initialized and ready');
  
  // Initialize dev server cleanup (removes old temp directories)
  initializeDevServerCleanup();
  console.log('🔧 Dev server cleanup initialized');
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Close the HTTP server
    server.close(() => {
      console.log('HTTP server closed');
    });

    // Close the Bull queue
    await fileProcessingQueue.close();

    // Stop all running dev servers
    await cleanupAllDevServers();
    console.log('Dev servers stopped');

    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, p) => {
  // p 是 promise，包含错误栈，如果是请求的话，还会包含 request 和 response 的信息
  // ref: http://nodejs.cn/api/process/event_unhandledrejection.html
  console.error('unhandledRejection', p);
});

process.on('uncaughtException', function (err, origin) {
  /* handle errors here */
  console.error('uncaughtException:', err, origin);
});

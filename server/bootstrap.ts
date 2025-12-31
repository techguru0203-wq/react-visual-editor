import { setGlobalDispatcher, ProxyAgent } from 'undici';
import dotenv from 'dotenv';

// read in process config values from env var for dev
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
// Setup proxy agent if proxy is configured
const proxy =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

if (proxy) {
  const dispatcher = new ProxyAgent(proxy);
  setGlobalDispatcher(dispatcher);
  console.log(`Using proxy: ${proxy}`);
}

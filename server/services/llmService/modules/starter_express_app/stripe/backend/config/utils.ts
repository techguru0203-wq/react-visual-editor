import { Request } from 'express';

/**
 * Dynamically obtain the current domain and protocol from the request headers
 * @param req Express Request object
 * @returns The full frontend URL
 */
export const getFrontendUrl = (req: Request): string => {
  // Check referer or origin header (when accessed via proxy)
  const referer = req.headers.referer || req.headers.origin;
  if (referer) {
    try {
      const url = new URL(referer);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      // If parsing fails, continue with the logic below
    }
  }

  // Fallback to getting from request headers
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;
  return origin;
};

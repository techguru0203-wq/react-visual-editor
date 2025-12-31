/**
 * Backend Authentication Middleware
 *
 * This file contains Express.js middleware for protecting backend routes.
 * Do NOT confuse this with frontend route protection (ProtectedRoute component).
 *
 * Backend (Express) route protection:
 * ✅ CORRECT:
 * import { authenticateJWT } from '../middleware/auth';
 * router.post('/api/protected', authenticateJWT, handler);
 *
 * ❌ INCORRECT:
 * router.post('/api/protected', requireAuth, handler);     // Don't use this name
 * router.post('/api/protected', authenticate, handler);    // Don't use this name
 * router.post('/api/protected', authenticateJWT());       // Don't call as function
 *
 * Note: While the frontend's ProtectedRoute component uses a prop named 'requireAuth',
 * this is completely separate from backend middleware. They serve different purposes:
 * - Backend (this file): Protects API endpoints using JWT validation
 * - Frontend (ProtectedRoute): Controls React component rendering based on auth state
 */

import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AUTH_ERRORS } from '../config/constants';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

// Middleware for routes that require authentication
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(new AppError(AUTH_ERRORS.UNAUTHORIZED, 401));
      }

      // Set user on request
      (req as AuthRequest).user = user;
      next();
    }
  )(req, res, next);
}

// Middleware for login and signup
export function authenticateLocal(
  req: Request,
  res: Response,
  next: NextFunction
) {
  passport.authenticate(
    'local',
    { session: false },
    (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(
          new AppError(info?.message || AUTH_ERRORS.INVALID_CREDENTIALS, 401)
        );
      }

      // Set user on request
      (req as AuthRequest).user = user;
      next();
    }
  )(req, res, next);
}

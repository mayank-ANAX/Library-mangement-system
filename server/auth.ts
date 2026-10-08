/**
 * Authentication and Role-based Authorization utilities
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lms-super-secret-jwt-key-2026-production';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'librarian';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Authentication Middleware
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(allowedRoles: ('admin' | 'librarian')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: `Permission denied. Access restricted to [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.` 
      });
      return;
    }

    next();
  };
}

import { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/supabase';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = { id: data.user.id };
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      req.user = { id: data.user.id };
    }
  }

  next();
}

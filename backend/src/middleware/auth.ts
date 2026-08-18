import { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/supabase';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phoneVerified: boolean;
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

  req.user = { id: data.user.id, phoneVerified: Boolean(data.user.phone_confirmed_at) };
  next();
}

/**
 * Публикация постов и комментариев требует подтверждённого телефона.
 * Ставится после requireAuth — тот уже наполнил req.user.
 */
export function requirePhoneVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.phoneVerified) {
    return res.status(403).json({ error: 'PHONE_NOT_VERIFIED' });
  }
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      req.user = { id: data.user.id, phoneVerified: Boolean(data.user.phone_confirmed_at) };
    }
  }

  next();
}

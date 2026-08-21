import { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/supabase';

export type UserRole = 'user' | 'moderator' | 'admin';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phoneVerified: boolean;
        role: UserRole;
        bannedUntil: string | null;
      };
    }
  }
}

/**
 * Роль и бан кешируются на минуту.
 *
 * Supabase.auth.getUser отвечает по токену, но роли и срока бана в токене нет —
 * они в таблице users, и без кеша каждый запрос к API стоил бы лишнего похода в
 * базу. Минута — это цена ошибки: столько забаненный ещё может писать, и
 * столько же снятый бан не даёт вернуться. Против часа, на который соблазнительно
 * растянуть кеш, это разница между «не заметил» и «написал в поддержку».
 *
 * Бан и смена роли сбрасывают запись сами (invalidateUserState), так что минуту
 * ждёт только тот, чью запись поменяли в обход API — руками в панели Supabase.
 */
type UserState = { role: UserRole; bannedUntil: string | null };

const STATE_TTL_MS = 60_000;
const stateCache = new Map<string, { state: UserState; expires: number }>();

export function invalidateUserState(userId: string) {
  stateCache.delete(userId);
}

async function userState(userId: string): Promise<UserState> {
  const cached = stateCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.state;

  const { data, error } = await supabase
    .from('users')
    .select('role, banned_until')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('auth: user state lookup failed', error);
    // Недоступная база не повод раздавать права модератора — но и не повод
    // выкидывать всех: считаем обычным незабаненным пользователем.
    return { role: 'user', bannedUntil: null };
  }

  const state: UserState = {
    role: (data?.role as UserRole) ?? 'user',
    bannedUntil: (data?.banned_until as string | null) ?? null,
  };

  stateCache.set(userId, { state, expires: Date.now() + STATE_TTL_MS });
  return state;
}

/** Действует ли бан прямо сейчас. Вечный бан хранится как 'infinity'. */
export function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  if (bannedUntil === 'infinity') return true;
  const until = new Date(bannedUntil).getTime();
  return Number.isFinite(until) ? until > Date.now() : true;
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

  const state = await userState(data.user.id);

  req.user = {
    id: data.user.id,
    phoneVerified: Boolean(data.user.phone_confirmed_at),
    role: state.role,
    bannedUntil: state.bannedUntil,
  };

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

/**
 * Забаненному закрыто написание, а не чтение.
 *
 * Выкинуть его из приложения целиком было бы проще, но тогда он не увидит ни
 * причины, ни срока — а именно они отличают наказание от поломки. Пусть читает
 * и видит, до какого числа молчит.
 *
 * Ответ отдаёт срок и причину: интерфейсу есть что показать, вместо «что-то
 * пошло не так».
 */
export function requireNotBanned(req: Request, res: Response, next: NextFunction) {
  if (req.user && isBanned(req.user.bannedUntil)) {
    return res.status(403).json({
      error: 'USER_BANNED',
      bannedUntil: req.user.bannedUntil,
    });
  }
  next();
}

/** Разбор жалоб и баны. Проверяется на сервере, а не спрятанной кнопкой. */
export function requireModerator(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== 'moderator' && role !== 'admin') {
    // 404, а не 403: существование раздела модерации — не то, о чём стоит
    // сообщать тому, кто в него постучался наугад.
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      const state = await userState(data.user.id);
      req.user = {
        id: data.user.id,
        phoneVerified: Boolean(data.user.phone_confirmed_at),
        role: state.role,
        bannedUntil: state.bannedUntil,
      };
    }
  }

  next();
}

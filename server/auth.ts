import crypto from 'crypto';
import { User, UserRole } from '../src/types.ts';

// Secure password hashing using crypto.scrypt
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch {
    return false;
  }
}

// In-memory active tokens mapping to user ID and session details
interface Session {
  token: string;
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, Session>();

// Session valid for 12 hours
const SESSION_TTL = 12 * 60 * 60 * 1000;

export function createSession(user: User): string {
  const token = `chkpt_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const session: Session = {
    token,
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  };
  activeSessions.set(token, session);
  return token;
}

export function getSession(token: string): Session | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token: string): boolean {
  return activeSessions.delete(token);
}

import crypto from 'node:crypto';
import type { AuthProvider, AuthProviderInfo, User, UserRole } from '../types.js';
import type { WorkspaceRepository } from '../../storage/repository.js';

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, actualSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: actualSalt
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch {
    return false;
  }
}

export class LocalAuthProvider implements AuthProvider {
  readonly id = 'local';
  readonly type = 'local' as const;
  readonly name = 'Local Database';

  constructor(private repo: WorkspaceRepository) {}

  getInfo(): AuthProviderInfo {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: true,
      description: 'Built-in local authentication using encrypted SQLite credentials'
    };
  }

  async authenticate(credentials: { username?: string; password?: string }): Promise<User | null> {
    if (!credentials.username || !credentials.password) {
      return null;
    }

    const record = this.repo.getUserByUsername(credentials.username);
    if (!record || !record.passwordHash || !record.salt) {
      return null;
    }

    const isValid = verifyPassword(credentials.password, record.passwordHash, record.salt);
    if (!isValid) {
      return null;
    }

    return {
      id: record.id,
      username: record.username,
      email: record.email,
      displayName: record.displayName,
      role: record.role as UserRole,
      provider: record.provider,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}

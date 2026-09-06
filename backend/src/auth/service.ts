import { sign, verify } from 'hono/jwt';
import type {
  User,
  UserSummary,
  UserRole,
  AuthProvider,
  AuthProviderInfo,
  JwtPayload
} from './types.js';
import type { WorkspaceRepository } from '../storage/repository.js';
import { LocalAuthProvider, hashPassword } from './providers/LocalAuthProvider.js';
import { EnterpriseOidcProvider } from './providers/EnterpriseOidcProvider.js';

export class AuthService {
  private repo: WorkspaceRepository;
  private jwtSecret: string;
  private providers: Map<string, AuthProvider> = new Map();

  constructor(
    repo: WorkspaceRepository,
    jwtSecret: string = process.env.AUTH_JWT_SECRET || 'openc4-jwt-secret-key-32-chars-long!!'
  ) {
    this.repo = repo;
    this.jwtSecret = jwtSecret;

    // Register Default Local Auth Provider
    this.registerProvider(new LocalAuthProvider(this.repo));

    // Register Enterprise OIDC Provider
    this.registerProvider(new EnterpriseOidcProvider(this.repo));

    // Seed default administrative, editor, and viewer accounts if table is empty
    this.ensureSeedUsers();
  }

  registerProvider(provider: AuthProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): AuthProvider | undefined {
    return this.providers.get(providerId);
  }

  getProviders(): AuthProviderInfo[] {
    return Array.from(this.providers.values()).map((p) => p.getInfo());
  }

  ensureSeedUsers() {
    if (this.repo.countUsers() === 0) {
      // 1. Admin
      const adminCreds = hashPassword('admin123');
      this.repo.createUser({
        username: 'admin',
        email: 'admin@openc4.org',
        displayName: 'System Administrator',
        passwordHash: adminCreds.hash,
        salt: adminCreds.salt,
        role: 'admin',
        provider: 'local'
      });

      // 2. Editor / Architect
      const architectCreds = hashPassword('architect123');
      this.repo.createUser({
        username: 'architect',
        email: 'architect@openc4.org',
        displayName: 'Software Architect',
        passwordHash: architectCreds.hash,
        salt: architectCreds.salt,
        role: 'editor',
        provider: 'local'
      });

      // 3. Viewer
      const viewerCreds = hashPassword('viewer123');
      this.repo.createUser({
        username: 'viewer',
        email: 'viewer@openc4.org',
        displayName: 'Architecture Viewer',
        passwordHash: viewerCreds.hash,
        salt: viewerCreds.salt,
        role: 'viewer',
        provider: 'local'
      });
    }
  }

  async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      provider: user.provider,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days expiration
    };
    return sign(payload, this.jwtSecret);
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = (await verify(token, this.jwtSecret, 'HS256')) as unknown as JwtPayload;
      if (!payload || !payload.sub) {
        return null;
      }
      const record = this.repo.getUserById(payload.sub);
      if (!record) {
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
    } catch {
      return null;
    }
  }

  async authenticate(
    providerId: string = 'local',
    credentials: any
  ): Promise<{ user: User; token: string } | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Authentication provider '${providerId}' not registered`);
    }

    const user = await provider.authenticate(credentials);
    if (!user) {
      return null;
    }

    const token = await this.generateToken(user);
    return { user, token };
  }

  listUsers(): UserSummary[] {
    const records = this.repo.listUsers();
    return records.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      displayName: r.displayName,
      role: r.role as UserRole,
      provider: r.provider,
      createdAt: r.createdAt
    }));
  }

  getUser(id: number): User | null {
    const record = this.repo.getUserById(id);
    if (!record) return null;
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

  createUser(data: {
    username: string;
    email: string;
    displayName: string;
    password?: string;
    role?: UserRole;
  }): User {
    const existing = this.repo.getUserByUsername(data.username);
    if (existing) {
      throw new Error(`Username '${data.username}' is already taken`);
    }

    let passwordHash: string | null = null;
    let salt: string | null = null;
    if (data.password) {
      const hashed = hashPassword(data.password);
      passwordHash = hashed.hash;
      salt = hashed.salt;
    }

    const record = this.repo.createUser({
      username: data.username,
      email: data.email,
      displayName: data.displayName || data.username,
      passwordHash,
      salt,
      role: data.role || 'viewer',
      provider: 'local'
    });

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

  updateUser(
    id: number,
    data: {
      email?: string;
      displayName?: string;
      role?: UserRole;
    }
  ): User | null {
    const updated = this.repo.updateUser(id, {
      email: data.email,
      displayName: data.displayName,
      role: data.role
    });
    if (!updated) return null;
    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role as UserRole,
      provider: updated.provider,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  deleteUser(id: number): boolean {
    const user = this.repo.getUserById(id);
    if (!user) return false;

    // Guard against deleting the last admin
    if (user.role === 'admin') {
      const allUsers = this.repo.listUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last remaining administrator');
      }
    }

    return this.repo.deleteUser(id);
  }

  resetPassword(id: number, newPassword: string): boolean {
    const user = this.repo.getUserById(id);
    if (!user) return false;

    const hashed = hashPassword(newPassword);
    this.repo.updateUser(id, {
      passwordHash: hashed.hash,
      salt: hashed.salt
    });
    return true;
  }
}

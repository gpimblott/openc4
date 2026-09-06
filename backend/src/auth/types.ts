import type { MongoAbility } from '@casl/ability';

export type UserRole = 'admin' | 'editor' | 'viewer';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'publish';
export type Subjects = 'Workspace' | 'User' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  provider: string; // 'local' | 'oidc' | 'saml' | 'ldap'
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  provider: string;
  createdAt: string;
}

export interface AuthProviderInfo {
  id: string;
  type: 'local' | 'oidc' | 'saml' | 'ldap';
  name: string;
  enabled: boolean;
  description?: string;
  icon?: string;
}

export interface AuthProvider {
  id: string;
  type: 'local' | 'oidc' | 'saml' | 'ldap';
  name: string;
  getInfo(): AuthProviderInfo;
  authenticate(credentials: any): Promise<User | null>;
}

export interface JwtPayload {
  sub: number;
  username: string;
  email: string;
  role: UserRole;
  provider: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

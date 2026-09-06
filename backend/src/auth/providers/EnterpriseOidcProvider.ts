import type { AuthProvider, AuthProviderInfo, User, UserRole } from '../types.js';
import type { WorkspaceRepository } from '../../storage/repository.js';

export interface OidcConfig {
  enabled: boolean;
  name?: string;
  issuerUrl?: string;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  roleClaim?: string;
  adminGroup?: string;
  editorGroup?: string;
}

/**
 * Pluggable Enterprise OpenID Connect / OAuth2 Authentication Provider.
 * Allows organizations to federate identities from Okta, Azure AD / Microsoft Entra ID,
 * Keycloak, Ping Identity, or Google Workspace, mapping enterprise groups to OpenC4 roles.
 */
export class EnterpriseOidcProvider implements AuthProvider {
  readonly id = 'oidc';
  readonly type = 'oidc' as const;
  readonly name: string;
  private config: OidcConfig;

  constructor(
    private repo: WorkspaceRepository,
    config?: Partial<OidcConfig>
  ) {
    this.config = {
      enabled: process.env.AUTH_OIDC_ENABLED === 'true' || config?.enabled === true,
      name: process.env.AUTH_OIDC_NAME || config?.name || 'Enterprise Single Sign-On (OIDC)',
      issuerUrl: process.env.AUTH_OIDC_ISSUER || config?.issuerUrl || '',
      clientId: process.env.AUTH_OIDC_CLIENT_ID || config?.clientId || '',
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET || config?.clientSecret || '',
      authorizationUrl: process.env.AUTH_OIDC_AUTH_URL || config?.authorizationUrl || '',
      tokenUrl: process.env.AUTH_OIDC_TOKEN_URL || config?.tokenUrl || '',
      roleClaim: process.env.AUTH_OIDC_ROLE_CLAIM || config?.roleClaim || 'groups',
      adminGroup: process.env.AUTH_OIDC_ADMIN_GROUP || config?.adminGroup || 'c4-admins',
      editorGroup: process.env.AUTH_OIDC_EDITOR_GROUP || config?.editorGroup || 'c4-architects',
      ...config
    };
    this.name = this.config.name || 'Enterprise SSO';
  }

  getInfo(): AuthProviderInfo {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: this.config.enabled,
      description: this.config.enabled
        ? `Enterprise SSO federated with ${this.config.issuerUrl || 'Identity Provider'}`
        : 'Enterprise OpenID Connect / SAML federation (configurable via environment)',
      icon: 'shield-check'
    };
  }

  /**
   * Maps enterprise claims or groups to OpenC4 RBAC roles.
   */
  mapRoleFromClaims(claims: Record<string, any>): UserRole {
    const roleClaimKey = this.config.roleClaim || 'groups';
    const groups = Array.isArray(claims[roleClaimKey])
      ? claims[roleClaimKey]
      : typeof claims[roleClaimKey] === 'string'
      ? [claims[roleClaimKey]]
      : [];

    if (this.config.adminGroup && groups.includes(this.config.adminGroup)) {
      return 'admin';
    }
    if (this.config.editorGroup && groups.includes(this.config.editorGroup)) {
      return 'editor';
    }
    return 'viewer';
  }

  /**
   * Authenticate an enterprise SSO assertion or token payload.
   * Upserts the federated user into the local repository with their mapped role.
   */
  async authenticate(credentials: {
    username?: string;
    email?: string;
    displayName?: string;
    claims?: Record<string, any>;
  }): Promise<User | null> {
    if (!this.config.enabled) {
      return null;
    }

    const email = credentials.email || credentials.claims?.email;
    const username = credentials.username || credentials.claims?.preferred_username || email?.split('@')[0];
    if (!username || !email) {
      return null;
    }

    const displayName =
      credentials.displayName ||
      credentials.claims?.name ||
      credentials.claims?.displayName ||
      username;

    const mappedRole = credentials.claims
      ? this.mapRoleFromClaims(credentials.claims)
      : 'viewer';

    let record = this.repo.getUserByUsername(username);
    if (!record) {
      record = this.repo.createUser({
        username,
        email,
        displayName,
        role: mappedRole,
        provider: 'oidc'
      });
    } else {
      // Update details and synchronize role from enterprise claims
      const updated = this.repo.updateUser(record.id, {
        email,
        displayName,
        role: mappedRole
      });
      if (updated) record = updated;
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

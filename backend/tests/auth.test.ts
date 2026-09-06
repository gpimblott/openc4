import { describe, it, expect, beforeAll } from 'vitest';
import { createApp, DEFAULT_SAMPLE_DSL } from '../src/api/app.js';
import { WorkspaceRepository } from '../src/storage/repository.js';
import { AuthService } from '../src/auth/service.js';
import { defineAbilityFor } from '../src/auth/ability.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Authentication & CASL RBAC', () => {
  let app: ReturnType<typeof createApp>;
  let repo: WorkspaceRepository;
  let authService: AuthService;
  const testDbPath = path.resolve('data/test_auth.db');

  let adminToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    repo = new WorkspaceRepository(testDbPath);
    authService = new AuthService(repo, 'test-jwt-secret-key-32-chars-ok!');
    app = createApp(repo, authService, { authRequired: true });

    // Seed test workspace
    repo.createWorkspace('Test Workspace', 'Testing auth', DEFAULT_SAMPLE_DSL);

    // Obtain tokens for all 3 seeded roles
    const adminLogin = await authService.authenticate('local', {
      username: 'admin',
      password: 'admin123'
    });
    adminToken = adminLogin!.token;

    const editorLogin = await authService.authenticate('local', {
      username: 'architect',
      password: 'architect123'
    });
    editorToken = editorLogin!.token;

    const viewerLogin = await authService.authenticate('local', {
      username: 'viewer',
      password: 'viewer123'
    });
    viewerToken = viewerLogin!.token;
  });

  describe('CASL Ability Rules Unit Verification', () => {
    it('grants admin full manage all abilities', () => {
      const adminUser = authService.getUser(1)!;
      const ability = defineAbilityFor(adminUser);
      expect(ability.can('manage', 'all')).toBe(true);
      expect(ability.can('read', 'Workspace')).toBe(true);
      expect(ability.can('update', 'Workspace')).toBe(true);
      expect(ability.can('delete', 'Workspace')).toBe(true);
      expect(ability.can('publish', 'Workspace')).toBe(true);
      expect(ability.can('manage', 'User')).toBe(true);
    });

    it('grants editor workspace authoring abilities, but denies user management', () => {
      const editorUser = authService.getUser(2)!;
      const ability = defineAbilityFor(editorUser);
      expect(ability.can('manage', 'all')).toBe(false);
      expect(ability.can('read', 'Workspace')).toBe(true);
      expect(ability.can('create', 'Workspace')).toBe(true);
      expect(ability.can('update', 'Workspace')).toBe(true);
      expect(ability.can('delete', 'Workspace')).toBe(true);
      expect(ability.can('publish', 'Workspace')).toBe(true);
      expect(ability.can('manage', 'User')).toBe(false);
    });

    it('grants viewer read-only abilities and denies modifications', () => {
      const viewerUser = authService.getUser(3)!;
      const ability = defineAbilityFor(viewerUser);
      expect(ability.can('read', 'Workspace')).toBe(true);
      expect(ability.can('create', 'Workspace')).toBe(false);
      expect(ability.can('update', 'Workspace')).toBe(false);
      expect(ability.can('delete', 'Workspace')).toBe(false);
      expect(ability.can('publish', 'Workspace')).toBe(false);
      expect(ability.can('manage', 'User')).toBe(false);
    });
  });

  describe('Authentication Endpoints', () => {
    it('returns available auth providers including local and enterprise oidc', async () => {
      const res = await app.request('/api/auth/providers');
      expect(res.status).toBe(200);
      const providers = await res.json();
      expect(providers.some((p: any) => p.id === 'local')).toBe(true);
      expect(providers.some((p: any) => p.id === 'oidc')).toBe(true);
    });

    it('authenticates valid credentials and issues JWT token', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.user.username).toBe('admin');
      expect(data.user.role).toBe('admin');
    });

    it('rejects invalid password with 401', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword'
        })
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('resolves authenticated user profile and CASL capabilities on /api/auth/me', async () => {
      const res = await app.request('/api/auth/me', {
        headers: { Authorization: `Bearer ${editorToken}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.username).toBe('architect');
      expect(data.user.role).toBe('editor');
      expect(data.canEdit).toBe(true);
      expect(data.canPublish).toBe(true);
      expect(data.isAdmin).toBe(false);
    });
  });

  describe('RBAC Endpoint Protection', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await app.request('/api/workspaces');
      expect(res.status).toBe(401);
    });

    it('allows viewer to read workspaces and inspect studio', async () => {
      const res = await app.request('/api/workspaces', {
        headers: { Authorization: `Bearer ${viewerToken}` }
      });
      expect(res.status).toBe(200);

      const studioRes = await app.request('/api/workspaces/1/studio', {
        headers: { Authorization: `Bearer ${viewerToken}` }
      });
      expect(studioRes.status).toBe(200);
    });

    it('blocks viewer from saving workspace with 403 Forbidden', async () => {
      const res = await app.request('/api/workspaces/1/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dsl: 'workspace {}' })
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('blocks viewer from publishing workspace with 403 Forbidden', async () => {
      const res = await app.request('/api/workspaces/1/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: '2.0.0' })
      });
      expect(res.status).toBe(403);
    });

    it('allows editor to save and modify workspace', async () => {
      const res = await app.request('/api/workspaces/1/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${editorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dsl: DEFAULT_SAMPLE_DSL })
      });
      expect(res.status).toBe(200);
    });

    it('blocks editor from accessing user management endpoints with 403 Forbidden', async () => {
      const res = await app.request('/api/auth/users', {
        headers: { Authorization: `Bearer ${editorToken}` }
      });
      expect(res.status).toBe(403);
    });

    it('allows admin to list, create, update, and manage users', async () => {
      // 1. List users
      const listRes = await app.request('/api/auth/users', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(listRes.status).toBe(200);
      const users = await listRes.json();
      expect(users.length).toBeGreaterThanOrEqual(3);

      // 2. Create new user
      const createRes = await app.request('/api/auth/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'consultant',
          email: 'consultant@example.com',
          displayName: 'External Consultant',
          password: 'consultant123',
          role: 'viewer'
        })
      });
      expect(createRes.status).toBe(201);
      const createdData = await createRes.json();
      const newUserId = createdData.user.id;

      // 3. Update user role from viewer to editor
      const updateRes = await app.request(`/api/auth/users/${newUserId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'editor' })
      });
      expect(updateRes.status).toBe(200);
      const updatedData = await updateRes.json();
      expect(updatedData.user.role).toBe('editor');

      // 4. Delete user
      const delRes = await app.request(`/api/auth/users/${newUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(delRes.status).toBe(200);
    });

    it('prevents administrator from deleting their own account', async () => {
      const res = await app.request('/api/auth/users/1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Cannot delete your own account');
    });
  });
});

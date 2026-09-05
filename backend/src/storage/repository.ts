/**
 * Storage repository for workspaces, versions, and enterprise catalog.
 * Uses native node:sqlite for zero-configuration, lightweight, ultra-reliable persistence.
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface WorkspaceRecord {
  id: number;
  name: string;
  description: string;
  apiKey: string;
  apiSecret: string;
  dslSource: string;
  jsonCache: Record<string, any>;
  layoutCache: Record<string, any>;
  state: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  description: string;
  state: string;
  version: string;
  updatedAt: string;
}

export interface VersionRecord {
  id: number;
  version: string;
  publishedAt: string;
  commitMessage: string;
}

export interface CatalogItem {
  id: string;
  workspaceId: number;
  name: string;
  description: string;
  tags: string;
  containers: any[];
  version: string;
  updatedAt: string;
}

export const DEFAULT_DB_PATH = path.resolve('data/structurizr.db');

export class WorkspaceRepository {
  private dbPath: string;
  private db: DatabaseSync;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    const parentDir = path.dirname(this.dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    this.db = new DatabaseSync(this.dbPath);
    this.initDb();
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        api_key TEXT UNIQUE NOT NULL,
        api_secret TEXT NOT NULL,
        dsl_source TEXT NOT NULL,
        json_cache TEXT DEFAULT '{}',
        layout_cache TEXT DEFAULT '{}',
        state TEXT DEFAULT 'DRAFT',
        version TEXT DEFAULT '1.0.0',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        version TEXT NOT NULL,
        dsl_source TEXT NOT NULL,
        json_cache TEXT NOT NULL,
        published_at TEXT NOT NULL,
        commit_message TEXT DEFAULT '',
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );

      CREATE TABLE IF NOT EXISTS enterprise_catalog (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        system_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        containers_json TEXT DEFAULT '[]',
        published_version TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_locks (
        workspace_id INTEGER PRIMARY KEY,
        agent TEXT NOT NULL,
        locked_at TEXT NOT NULL
      );
    `);
  }

  createWorkspace(name: string, description: string = '', dslSource: string = ''): WorkspaceRecord {
    const apiKey = crypto.randomUUID();
    const apiSecret = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    const insert = this.db.prepare(`
      INSERT INTO workspaces (name, description, api_key, api_secret, dsl_source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(name, description, apiKey, apiSecret, dslSource, now, now);
    const wsId = Number(result.lastInsertRowid);

    return this.getWorkspace(wsId)!;
  }

  getWorkspace(workspaceId: number): WorkspaceRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM workspaces WHERE id = ?`);
    const row: any = stmt.get(workspaceId);
    if (!row) return null;

    return {
      id: Number(row.id),
      name: row.name,
      description: row.description,
      apiKey: row.api_key,
      apiSecret: row.api_secret,
      dslSource: row.dsl_source,
      jsonCache: row.json_cache ? JSON.parse(row.json_cache) : {},
      layoutCache: row.layout_cache ? JSON.parse(row.layout_cache) : {},
      state: row.state,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  listWorkspaces(): WorkspaceSummary[] {
    const stmt = this.db.prepare(
      `SELECT id, name, description, state, version, updated_at FROM workspaces ORDER BY updated_at DESC`
    );
    const rows: any[] = stmt.all() as any[];

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      description: r.description,
      state: r.state,
      version: r.version,
      updatedAt: r.updated_at
    }));
  }

  updateWorkspace(
    workspaceId: number,
    updates: {
      dslSource?: string | null;
      jsonCache?: Record<string, any> | null;
      layoutCache?: Record<string, any> | null;
      name?: string | null;
      description?: string | null;
      state?: string | null;
    }
  ): WorkspaceRecord | null {
    const curr = this.getWorkspace(workspaceId);
    if (!curr) return null;

    const now = new Date().toISOString();
    const newDsl = updates.dslSource !== undefined && updates.dslSource !== null ? updates.dslSource : curr.dslSource;
    const newJson = updates.jsonCache !== undefined && updates.jsonCache !== null
      ? JSON.stringify(updates.jsonCache)
      : JSON.stringify(curr.jsonCache);
    const newLayout = updates.layoutCache !== undefined && updates.layoutCache !== null
      ? JSON.stringify(updates.layoutCache)
      : JSON.stringify(curr.layoutCache);
    const newName = updates.name !== undefined && updates.name !== null ? updates.name : curr.name;
    const newDesc = updates.description !== undefined && updates.description !== null ? updates.description : curr.description;
    const newState = updates.state !== undefined && updates.state !== null ? updates.state : curr.state;

    const stmt = this.db.prepare(`
      UPDATE workspaces
      SET dsl_source = ?, json_cache = ?, layout_cache = ?, name = ?, description = ?, state = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(newDsl, newJson, newLayout, newName, newDesc, newState, now, workspaceId);

    return this.getWorkspace(workspaceId);
  }

  publishWorkspaceVersion(
    workspaceId: number,
    version: string,
    commitMessage: string = ''
  ): { workspaceId: number; version: string; publishedAt: string } {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const now = new Date().toISOString();

    const insVersion = this.db.prepare(`
      INSERT INTO workspace_versions (workspace_id, version, dsl_source, json_cache, published_at, commit_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insVersion.run(workspaceId, version, ws.dslSource, JSON.stringify(ws.jsonCache), now, commitMessage);

    const updateWs = this.db.prepare(`
      UPDATE workspaces
      SET version = ?, state = 'PUBLISHED', updated_at = ?
      WHERE id = ?
    `);
    updateWs.run(version, now, workspaceId);

    // Publish systems into enterprise catalog
    const jsonData = ws.jsonCache;
    if (jsonData.model && Array.isArray(jsonData.model.softwareSystems)) {
      const insCat = this.db.prepare(`
        INSERT OR REPLACE INTO enterprise_catalog (id, workspace_id, system_name, description, tags, containers_json, published_version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sys of jsonData.model.softwareSystems) {
        const sysId = `sys_${workspaceId}_${sys.id}`;
        const containersStr = JSON.stringify(sys.containers || []);
        insCat.run(
          sysId,
          workspaceId,
          sys.name,
          sys.description || '',
          sys.tags || '',
          containersStr,
          version,
          now
        );
      }
    }

    return { workspaceId, version, publishedAt: now };
  }

  listVersions(workspaceId: number): VersionRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, version, published_at, commit_message FROM workspace_versions
      WHERE workspace_id = ? ORDER BY id DESC
    `);
    const rows: any[] = stmt.all(workspaceId) as any[];

    return rows.map((r) => ({
      id: Number(r.id),
      version: r.version,
      publishedAt: r.published_at,
      commitMessage: r.commit_message
    }));
  }

  getVersionSnapshot(
    workspaceId: number,
    version: string
  ): { dslSource: string; jsonCache: Record<string, any>; publishedAt: string; commitMessage: string } | null {
    const stmt = this.db.prepare(`
      SELECT dsl_source, json_cache, published_at, commit_message FROM workspace_versions
      WHERE workspace_id = ? AND version = ?
    `);
    const row: any = stmt.get(workspaceId, version);
    if (!row) return null;

    return {
      dslSource: row.dsl_source,
      jsonCache: row.json_cache ? JSON.parse(row.json_cache) : {},
      publishedAt: row.published_at,
      commitMessage: row.commit_message
    };
  }

  getEnterpriseCatalog(): CatalogItem[] {
    const stmt = this.db.prepare(`
      SELECT id, workspace_id, system_name, description, tags, containers_json, published_version, updated_at
      FROM enterprise_catalog ORDER BY system_name ASC
    `);
    const rows: any[] = stmt.all() as any[];

    return rows.map((r) => ({
      id: r.id,
      workspaceId: Number(r.workspace_id),
      name: r.system_name,
      description: r.description,
      tags: r.tags,
      containers: r.containers_json ? JSON.parse(r.containers_json) : [],
      version: r.published_version,
      updatedAt: r.updated_at
    }));
  }

  regenerateApiKey(workspaceId: number): { apiKey: string; apiSecret: string } | null {
    const newKey = crypto.randomUUID();
    const newSecret = crypto.randomBytes(24).toString('hex');
    const stmt = this.db.prepare(`UPDATE workspaces SET api_key = ?, api_secret = ? WHERE id = ?`);
    const result = stmt.run(newKey, newSecret, workspaceId);
    if (result.changes === 0) return null;

    return { apiKey: newKey, apiSecret: newSecret };
  }
}

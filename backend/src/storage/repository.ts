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

export interface WorkspaceFileRecord {
  id: number;
  workspaceId: number;
  filePath: string;
  content: string;
  isEntryPoint: boolean;
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

      CREATE TABLE IF NOT EXISTS workspace_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        is_entry_point INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        UNIQUE(workspace_id, file_path)
      );

      CREATE TABLE IF NOT EXISTS workspace_folders (
        workspace_id INTEGER NOT NULL,
        folder_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, folder_path),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
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

    // Seed default workspace.dsl as entry point
    const insertFile = this.db.prepare(`
      INSERT INTO workspace_files (workspace_id, file_path, content, is_entry_point, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertFile.run(wsId, 'workspace.dsl', dslSource, 1, now);

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
        const cleanVer = version.replace(/[^a-zA-Z0-9._-]/g, '_');
        const sysId = `sys_${workspaceId}_${sys.id}_v${cleanVer}`;
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

  restoreWorkspaceVersion(
    workspaceId: number,
    version: string
  ): WorkspaceRecord | null {
    const snap = this.getVersionSnapshot(workspaceId, version);
    if (!snap) return null;

    const now = new Date().toISOString();
    const updateWs = this.db.prepare(`
      UPDATE workspaces
      SET dsl_source = ?, json_cache = ?, version = ?, state = 'PUBLISHED', updated_at = ?
      WHERE id = ?
    `);
    updateWs.run(snap.dslSource, JSON.stringify(snap.jsonCache), version, now, workspaceId);

    return this.getWorkspace(workspaceId);
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

  getEnterpriseCatalog(options?: { latestOnly?: boolean; workspaceId?: number }): CatalogItem[] {
    let query = `
      SELECT id, workspace_id, system_name, description, tags, containers_json, published_version, updated_at
      FROM enterprise_catalog
    `;
    const params: any[] = [];
    if (options?.workspaceId !== undefined && !isNaN(options.workspaceId)) {
      query += ` WHERE workspace_id = ? `;
      params.push(options.workspaceId);
    }
    query += ` ORDER BY system_name ASC, updated_at DESC`;

    const stmt = this.db.prepare(query);
    const rows: any[] = (params.length > 0 ? stmt.all(...params) : stmt.all()) as any[];

    const items: CatalogItem[] = rows.map((r) => ({
      id: r.id,
      workspaceId: Number(r.workspace_id),
      name: r.system_name,
      description: r.description,
      tags: r.tags,
      containers: r.containers_json ? JSON.parse(r.containers_json) : [],
      version: r.published_version,
      updatedAt: r.updated_at
    }));

    if (!options?.latestOnly) {
      return items;
    }

    const latestMap = new Map<string, CatalogItem>();
    for (const item of items) {
      const existing = latestMap.get(item.name);
      if (!existing) {
        latestMap.set(item.name, item);
      } else {
        const partsA = (item.version || '').replace(/^v/, '').split('.').map((p) => parseInt(p, 10));
        const partsB = (existing.version || '').replace(/^v/, '').split('.').map((p) => parseInt(p, 10));
        let isItemNewer = false;
        const maxLen = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < maxLen; i++) {
          const numA = isNaN(partsA[i]) ? 0 : partsA[i];
          const numB = isNaN(partsB[i]) ? 0 : partsB[i];
          if (numA > numB) {
            isItemNewer = true;
            break;
          }
          if (numA < numB) {
            isItemNewer = false;
            break;
          }
        }
        if (isItemNewer || (!partsA.some((p, idx) => p !== partsB[idx]) && new Date(item.updatedAt) > new Date(existing.updatedAt))) {
          latestMap.set(item.name, item);
        }
      }
    }

    return Array.from(latestMap.values());
  }

  regenerateApiKey(workspaceId: number): { apiKey: string; apiSecret: string } | null {
    const newKey = crypto.randomUUID();
    const newSecret = crypto.randomBytes(24).toString('hex');
    const stmt = this.db.prepare(`UPDATE workspaces SET api_key = ?, api_secret = ? WHERE id = ?`);
    const result = stmt.run(newKey, newSecret, workspaceId);
    if (result.changes === 0) return null;

    return { apiKey: newKey, apiSecret: newSecret };
  }

  getWorkspaceFiles(workspaceId: number): WorkspaceFileRecord[] {
    const stmt = this.db.prepare(
      'SELECT id, workspace_id, file_path, content, is_entry_point, updated_at FROM workspace_files WHERE workspace_id = ? ORDER BY is_entry_point DESC, file_path ASC'
    );
    let rows = stmt.all(workspaceId) as any[];
    const hasEntry = rows.some((r) => r.file_path === 'workspace.dsl');
    if (!hasEntry) {
      const ws = this.getWorkspace(workspaceId);
      if (ws) {
        const now = new Date().toISOString();
        const ins = this.db.prepare(
          'INSERT INTO workspace_files (workspace_id, file_path, content, is_entry_point, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        ins.run(workspaceId, 'workspace.dsl', ws.dslSource || '', 1, now);
        rows = stmt.all(workspaceId) as any[];
      }
    }
    return rows.map((r) => ({
      id: Number(r.id),
      workspaceId: Number(r.workspace_id),
      filePath: r.file_path,
      content: r.content,
      isEntryPoint: Boolean(r.is_entry_point),
      updatedAt: r.updated_at
    }));
  }

  saveWorkspaceFile(
    workspaceId: number,
    filePath: string,
    content: string,
    isEntryPoint: boolean = false
  ): WorkspaceFileRecord {
    const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const now = new Date().toISOString();
    const isEntry = isEntryPoint || cleanPath === 'workspace.dsl' ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO workspace_files (workspace_id, file_path, content, is_entry_point, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, file_path) DO UPDATE SET
        content = excluded.content,
        is_entry_point = excluded.is_entry_point,
        updated_at = excluded.updated_at
    `);
    stmt.run(workspaceId, cleanPath, content, isEntry, now);

    const getStmt = this.db.prepare(
      'SELECT id, workspace_id, file_path, content, is_entry_point, updated_at FROM workspace_files WHERE workspace_id = ? AND file_path = ?'
    );
    const row = getStmt.get(workspaceId, cleanPath) as any;
    return {
      id: Number(row.id),
      workspaceId: Number(row.workspace_id),
      filePath: row.file_path,
      content: row.content,
      isEntryPoint: Boolean(row.is_entry_point),
      updatedAt: row.updated_at
    };
  }

  saveWorkspaceFiles(
    workspaceId: number,
    files: Record<string, string>,
    entryPoint: string = 'workspace.dsl'
  ): WorkspaceFileRecord[] {
    for (const [path, content] of Object.entries(files)) {
      this.saveWorkspaceFile(workspaceId, path, content, path === entryPoint);
    }
    return this.getWorkspaceFiles(workspaceId);
  }

  deleteWorkspaceFile(workspaceId: number, filePath: string): boolean {
    const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (cleanPath === 'workspace.dsl') {
      throw new Error('Cannot delete entry point workspace.dsl');
    }
    const stmt = this.db.prepare(
      'DELETE FROM workspace_files WHERE workspace_id = ? AND file_path = ?'
    );
    const res = stmt.run(workspaceId, cleanPath);
    return res.changes > 0;
  }

  renameWorkspaceFile(workspaceId: number, oldPath: string, newPath: string): boolean {
    const cleanOld = oldPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const cleanNew = newPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (cleanOld === 'workspace.dsl') {
      throw new Error('Cannot rename entry point workspace.dsl');
    }
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'UPDATE workspace_files SET file_path = ?, updated_at = ? WHERE workspace_id = ? AND file_path = ?'
    );
    const res = stmt.run(cleanNew, now, workspaceId, cleanOld);
    return res.changes > 0;
  }

  getWorkspaceFolders(workspaceId: number): string[] {
    const foldersSet = new Set<string>();

    // 1. Explicitly created folders
    const stmt = this.db.prepare(
      'SELECT folder_path FROM workspace_folders WHERE workspace_id = ? ORDER BY folder_path ASC'
    );
    const rows = stmt.all(workspaceId) as any[];
    for (const r of rows) {
      foldersSet.add(r.folder_path);
    }

    // 2. Folders inferred from existing files
    const files = this.getWorkspaceFiles(workspaceId);
    for (const f of files) {
      const parts = f.filePath.split('/');
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          foldersSet.add(parts.slice(0, i).join('/'));
        }
      }
    }

    return Array.from(foldersSet).sort();
  }

  createWorkspaceFolder(workspaceId: number, folderPath: string): string {
    const cleanPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleanPath) {
      throw new Error('Folder path cannot be empty');
    }
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO workspace_folders (workspace_id, folder_path, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(workspaceId, cleanPath, now);
    return cleanPath;
  }

  deleteWorkspaceFolder(workspaceId: number, folderPath: string): boolean {
    const cleanPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleanPath) return false;

    // Delete folder entry
    const deleteFolderStmt = this.db.prepare(
      'DELETE FROM workspace_folders WHERE workspace_id = ? AND (folder_path = ? OR folder_path LIKE ?)'
    );
    deleteFolderStmt.run(workspaceId, cleanPath, `${cleanPath}/%`);

    // Delete files inside this folder (never deleting workspace.dsl)
    const deleteFilesStmt = this.db.prepare(
      'DELETE FROM workspace_files WHERE workspace_id = ? AND file_path LIKE ? AND file_path != ?'
    );
    deleteFilesStmt.run(workspaceId, `${cleanPath}/%`, 'workspace.dsl');

    return true;
  }

  renameWorkspaceFolder(workspaceId: number, oldPath: string, newPath: string): boolean {
    const cleanOld = oldPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanNew = newPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false;

    const now = new Date().toISOString();

    // 1. Rename folder in workspace_folders
    const updateFolder = this.db.prepare(`
      UPDATE workspace_folders
      SET folder_path = ? || substr(folder_path, length(?) + 1)
      WHERE workspace_id = ? AND (folder_path = ? OR folder_path LIKE ?)
    `);
    updateFolder.run(cleanNew, cleanOld, workspaceId, cleanOld, `${cleanOld}/%`);

    // 2. Rename files inside folder
    const updateFiles = this.db.prepare(`
      UPDATE workspace_files
      SET file_path = ? || substr(file_path, length(?) + 1), updated_at = ?
      WHERE workspace_id = ? AND file_path LIKE ? AND file_path != ?
    `);
    updateFiles.run(cleanNew, cleanOld, now, workspaceId, `${cleanOld}/%`, 'workspace.dsl');

    return true;
  }
}

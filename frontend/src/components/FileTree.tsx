import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Star,
  AlertCircle,
  X,
  Check,
  PanelLeftClose
} from 'lucide-react';

interface FileTreeProps {
  files: string[];
  activeFile: string;
  entryPoint: string;
  errorFile?: string | null;
  dirtyFiles?: Set<string>;
  onSelectFile: (filePath: string) => void;
  onCreateFile: (filePath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onToggleCollapse?: () => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', fullPath: '', isFolder: true, children: [] };

  for (const path of paths) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const subPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: subPath,
          isFolder: !isLast,
          children: []
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort folders first, then alphabetically
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (a.name === 'workspace.dsl') return -1;
      if (b.name === 'workspace.dsl') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isFolder) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(root.children);
  return root.children;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  entryPoint,
  errorFile,
  dirtyFiles = new Set(),
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onToggleCollapse
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFilePath, setNewFilePath] = useState<string>('');
  const [newFileFolder, setNewFileFolder] = useState<string>('');
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const tree = buildTree(files);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const startCreate = (folderPrefix: string = '') => {
    setNewFileFolder(folderPrefix);
    setNewFilePath('');
    setIsCreatingFile(true);
  };

  const handleConfirmCreate = () => {
    let trimmed = newFilePath.trim();
    if (!trimmed) return;
    if (!trimmed.endsWith('.dsl')) {
      trimmed += '.dsl';
    }
    const full = newFileFolder ? `${newFileFolder}/${trimmed}` : trimmed;
    onCreateFile(full);
    setIsCreatingFile(false);
    setNewFilePath('');
  };

  const startRename = (path: string) => {
    setEditingPath(path);
    const parts = path.split('/');
    setRenameValue(parts[parts.length - 1]);
  };

  const handleConfirmRename = () => {
    if (!editingPath) return;
    let trimmed = renameValue.trim();
    if (!trimmed) {
      setEditingPath(null);
      return;
    }
    if (!trimmed.endsWith('.dsl')) {
      trimmed += '.dsl';
    }
    const parts = editingPath.split('/');
    parts[parts.length - 1] = trimmed;
    const newFull = parts.join('/');
    if (newFull !== editingPath) {
      onRenameFile(editingPath, newFull);
    }
    setEditingPath(null);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const isSelected = activeFile === node.fullPath;
    const isEntry = node.fullPath === entryPoint;
    const hasError = errorFile === node.fullPath;
    const isDirty = dirtyFiles.has(node.fullPath);
    const isEditing = editingPath === node.fullPath;

    if (node.isFolder) {
      return (
        <div key={node.fullPath} className="select-none">
          <div
            className={`group flex items-center justify-between py-1 px-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 rounded cursor-pointer transition-colors`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(node.fullPath)}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-slate-500">
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </span>
              <span className="text-amber-400">
                {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
              </span>
              <span className="truncate">{node.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-slate-400">
              <button
                type="button"
                title="New file in this folder"
                className="hover:text-blue-400 p-0.5 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  startCreate(node.fullPath);
                }}
              >
                <FilePlus size={12} />
              </button>
            </div>
          </div>
          {!isCollapsed && (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf file
    return (
      <div
        key={node.fullPath}
        className={`group flex items-center justify-between py-1 px-2 text-xs rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-600/20 text-blue-300 font-medium border-l-2 border-blue-500'
            : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
        }`}
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
        onClick={() => onSelectFile(node.fullPath)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
          <FileCode size={13} className={isSelected ? 'text-blue-400' : 'text-slate-500'} />
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') setEditingPath(null);
                }}
                autoFocus
                className="bg-slate-900 border border-blue-500 text-white px-1 py-0.5 text-xs rounded outline-none w-28"
              />
              <button
                type="button"
                onClick={handleConfirmRename}
                className="text-emerald-400 hover:text-emerald-300"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setEditingPath(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <span className="truncate">{node.name}</span>
          )}

          {isEntry && (
            <span title="Entry Point (workspace.dsl)">
              <Star size={11} className="text-amber-400 fill-amber-400/30 ml-1 shrink-0" />
            </span>
          )}
          {hasError && (
            <span title="Syntax or Preprocessor Error">
              <AlertCircle size={12} className="text-rose-400 ml-1 shrink-0" />
            </span>
          )}
          {isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 ml-1" title="Unsaved changes" />
          )}
        </div>

        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-slate-500 ml-1">
            {!isEntry && (
              <>
                <button
                  type="button"
                  title="Rename File"
                  className="hover:text-slate-200 p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(node.fullPath);
                  }}
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  title="Delete File"
                  className="hover:text-rose-400 p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${node.fullPath}?`)) {
                      onDeleteFile(node.fullPath);
                    }
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 select-none">
      {/* FileTree Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40">
        <span className="flex items-center gap-1.5">
          <span>Files</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono text-slate-300">
            {files.length}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="New File"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
            onClick={() => startCreate('')}
          >
            <FilePlus size={13} />
          </button>
          <button
            type="button"
            title="New Folder"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
            onClick={() => {
              const folderName = prompt('Enter new folder path (e.g. systems):');
              if (folderName) {
                onCreateFile(`${folderName.replace(/\/+$/, '')}/index.dsl`);
              }
            }}
          >
            <FolderPlus size={13} />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              title="Hide File Explorer"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors ml-0.5"
              onClick={onToggleCollapse}
            >
              <PanelLeftClose size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Creation inline prompt */}
      {isCreatingFile && (
        <div className="px-2 py-1.5 border-b border-slate-800 bg-slate-950/80">
          <div className="text-[10px] text-slate-400 mb-1">
            {newFileFolder ? `New file in ${newFileFolder}/` : 'New file path:'}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. systems/orders.dsl"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate();
                if (e.key === 'Escape') setIsCreatingFile(false);
              }}
              autoFocus
              className="bg-slate-900 border border-blue-500/70 text-white text-xs px-2 py-0.5 rounded outline-none w-full font-mono"
            />
            <button
              type="button"
              onClick={handleConfirmCreate}
              className="text-emerald-400 hover:text-emerald-300 p-0.5"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFile(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tree View list */}
      <div className="flex-1 overflow-y-auto py-1 px-1 space-y-0.5 font-mono">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};

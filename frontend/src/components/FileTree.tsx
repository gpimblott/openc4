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
  PanelLeftClose,
  CornerDownRight
} from 'lucide-react';

interface FileTreeProps {
  files: string[];
  folders?: string[];
  activeFile: string;
  entryPoint: string;
  errorFile?: string | null;
  dirtyFiles?: Set<string>;
  onSelectFile: (filePath: string) => void;
  onCreateFile: (filePath: string) => void;
  onCreateFolder?: (folderPath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onMoveFile?: (sourcePath: string, targetPath: string) => void;
  onToggleCollapse?: () => void;
  readOnly?: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: TreeNode[];
}

function getParentFolder(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

function buildTree(paths: string[], folders: string[] = []): TreeNode[] {
  const root: TreeNode = { name: '', fullPath: '', isFolder: true, children: [] };

  // 1. Process explicit folders
  for (const folder of folders) {
    const clean = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    const parts = clean.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const subPath = parts.slice(0, i + 1).join('/');
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: subPath,
          isFolder: true,
          children: []
        };
        current.children.push(child);
      } else {
        child.isFolder = true;
      }
      current = child;
    }
  }

  // 2. Process files
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

  // Sort folders first, then alphabetically, keeping workspace.dsl prioritized
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
  folders = [],
  activeFile,
  entryPoint,
  errorFile,
  dirtyFiles = new Set(),
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onDeleteFolder,
  onMoveFile,
  onToggleCollapse,
  readOnly = false
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  
  // File creation states
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFilePath, setNewFilePath] = useState<string>('');
  const [newFileFolder, setNewFileFolder] = useState<string>('');
  
  // Folder creation states
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderPath, setNewFolderPath] = useState<string>('');
  const [newFolderParent, setNewFolderParent] = useState<string>('');

  // Inline rename state
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  // Drag and drop states
  const [draggedFile, setDraggedFile] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const tree = buildTree(files, folders);

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
    setIsCreatingFolder(false);
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
    if (newFileFolder) {
      setCollapsedFolders((prev) => {
        const next = new Set(prev);
        next.delete(newFileFolder);
        return next;
      });
    }
  };

  const startCreateFolder = (parentPrefix: string = '') => {
    setNewFolderParent(parentPrefix);
    setNewFolderPath('');
    setIsCreatingFolder(true);
    setIsCreatingFile(false);
  };

  const handleConfirmCreateFolder = () => {
    let trimmed = newFolderPath.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
      setIsCreatingFolder(false);
      return;
    }
    const full = newFolderParent ? `${newFolderParent}/${trimmed}` : trimmed;
    if (onCreateFolder) {
      onCreateFolder(full);
    }
    setIsCreatingFolder(false);
    setNewFolderPath('');
    if (newFolderParent) {
      setCollapsedFolders((prev) => {
        const next = new Set(prev);
        next.delete(newFolderParent);
        return next;
      });
    }
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

  const handleDropOnFolder = (targetFolder: string) => {
    if (!draggedFile) return;
    const currentParent = getParentFolder(draggedFile);
    if (currentParent === targetFolder) return;

    const fileName = draggedFile.split('/').pop()!;
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (draggedFile !== newPath && onMoveFile) {
      onMoveFile(draggedFile, newPath);
    }
    setDraggedFile(null);
    setDragOverTarget(null);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const isSelected = activeFile === node.fullPath;
    const isEntry = node.fullPath === entryPoint;
    const hasError = errorFile === node.fullPath;
    const isDirty = dirtyFiles.has(node.fullPath);
    const isEditing = editingPath === node.fullPath;

    if (node.isFolder) {
      const isDragOver = dragOverTarget === node.fullPath;
      const canDrop = draggedFile && !draggedFile.startsWith(node.fullPath + '/') && getParentFolder(draggedFile) !== node.fullPath;

      return (
        <div key={node.fullPath} className="select-none">
          <div
            className={`group flex items-center justify-between py-1 px-2 text-xs font-medium rounded cursor-pointer transition-colors ${
              isDragOver
                ? 'bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/80'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(node.fullPath)}
            onDragOver={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverTarget !== node.fullPath) {
                setDragOverTarget(node.fullPath);
              }
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverTarget === node.fullPath) {
                setDragOverTarget(null);
              }
            }}
            onDrop={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              e.stopPropagation();
              handleDropOnFolder(node.fullPath);
              if (isCollapsed) {
                toggleFolder(node.fullPath);
              }
            }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
              <span className="text-slate-500">
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </span>
              <span className={isDragOver ? 'text-blue-400' : 'text-amber-400'}>
                {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
              </span>
              <span className="truncate">{node.name}</span>
            </div>

            {!readOnly && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-slate-400">
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
                <button
                  type="button"
                  title="New subfolder"
                  className="hover:text-amber-400 p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreateFolder(node.fullPath);
                  }}
                >
                  <FolderPlus size={12} />
                </button>
                {onDeleteFolder && (
                  <button
                    type="button"
                    title="Delete Folder"
                    className="hover:text-rose-400 p-0.5 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete folder '${node.fullPath}' and its contents?`)) {
                        onDeleteFolder(node.fullPath);
                      }
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div>
              {node.children.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    if (!canDrop) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverTarget !== node.fullPath) {
                      setDragOverTarget(node.fullPath);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverTarget === node.fullPath) {
                      setDragOverTarget(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (!canDrop) return;
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnFolder(node.fullPath);
                  }}
                  className={`py-1 px-3 text-[10px] italic rounded border border-dashed mx-2 my-0.5 transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-600/30 text-blue-200'
                      : 'border-slate-800 text-slate-500'
                  }`}
                  style={{ marginLeft: `${(depth + 1) * 12 + 8}px` }}
                >
                  Empty folder — drop files here
                </div>
              ) : (
                node.children.map((child) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    // Leaf file
    const isDraggable = !readOnly && !isEntry;
    const isBeingDragged = draggedFile === node.fullPath;

    return (
      <div
        key={node.fullPath}
        draggable={isDraggable}
        onDragStart={(e) => {
          if (!isDraggable) return;
          e.dataTransfer.setData('text/plain', node.fullPath);
          e.dataTransfer.effectAllowed = 'move';
          setDraggedFile(node.fullPath);
        }}
        onDragEnd={() => {
          setDraggedFile(null);
          setDragOverTarget(null);
        }}
        className={`group flex items-center justify-between py-1 px-2 text-xs rounded transition-colors ${
          isBeingDragged
            ? 'opacity-40 bg-slate-800'
            : isSelected
            ? 'bg-blue-600/20 text-blue-300 font-medium border-l-2 border-blue-500'
            : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
        } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
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

        {!readOnly && !isEditing && (
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
    <div
      className="flex flex-col h-full bg-slate-900 border-r border-slate-800 select-none"
      onDragOver={(e) => {
        if (draggedFile && getParentFolder(draggedFile) !== '') {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
    >
      {/* FileTree Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40">
        <span className="flex items-center gap-1.5">
          <span>Files</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono text-slate-300">
            {files.length}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
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
                onClick={() => startCreateFolder('')}
              >
                <FolderPlus size={13} />
              </button>
            </>
          )}
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

      {/* File Creation inline prompt */}
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

      {/* Folder Creation inline prompt */}
      {isCreatingFolder && (
        <div className="px-2 py-1.5 border-b border-slate-800 bg-slate-950/80">
          <div className="text-[10px] text-amber-400 mb-1 flex items-center gap-1">
            <FolderPlus size={11} />
            <span>{newFolderParent ? `New folder in ${newFolderParent}/` : 'New folder name:'}</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. systems"
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateFolder();
                if (e.key === 'Escape') setIsCreatingFolder(false);
              }}
              autoFocus
              className="bg-slate-900 border border-amber-500/70 text-white text-xs px-2 py-0.5 rounded outline-none w-full font-mono"
            />
            <button
              type="button"
              onClick={handleConfirmCreateFolder}
              className="text-emerald-400 hover:text-emerald-300 p-0.5"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Drop Zone for moving back to root */}
      {draggedFile && getParentFolder(draggedFile) !== '' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverTarget !== '__root__') setDragOverTarget('__root__');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragOverTarget === '__root__') setDragOverTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropOnFolder('');
          }}
          className={`mx-2 my-1.5 py-1.5 px-2 text-[11px] text-center rounded border border-dashed transition-all flex items-center justify-center gap-1.5 ${
            dragOverTarget === '__root__'
              ? 'border-blue-400 bg-blue-600/30 text-blue-200 ring-1 ring-blue-400'
              : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-600'
          }`}
        >
          <CornerDownRight size={12} className="text-blue-400" />
          <span>Drop here to move to root</span>
        </div>
      )}

      {/* Tree View list */}
      <div
        className="flex-1 overflow-y-auto py-1 px-1 space-y-0.5 font-mono"
        onDragOver={(e) => {
          if (draggedFile && getParentFolder(draggedFile) !== '') {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          if (draggedFile && getParentFolder(draggedFile) !== '') {
            e.preventDefault();
            e.stopPropagation();
            handleDropOnFolder('');
          }
        }}
      >
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};

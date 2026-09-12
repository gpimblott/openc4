import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, MoreHorizontal } from 'lucide-react';

interface WorkspaceMenuProps {
  canEdit: boolean;
  canDelete: boolean;
  hasWorkspaces: boolean;
  workspaceName?: string;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: () => void;
}

export function WorkspaceMenu({
  canEdit,
  canDelete,
  hasWorkspaces,
  workspaceName,
  onCreateWorkspace,
  onDeleteWorkspace,
}: WorkspaceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Workspace actions"
        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition shrink-0 cursor-pointer flex items-center justify-center"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
            Workspace
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateWorkspace();
              }}
              className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-200 hover:text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>New Workspace...</span>
            </button>
          )}

          {canDelete && hasWorkspaces && (
            <>
              {canEdit && <div className="my-1 border-t border-slate-800" />}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onDeleteWorkspace();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 hover:bg-rose-950/50 text-rose-300 hover:text-rose-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Delete {workspaceName ? `"${workspaceName}"` : 'Workspace'}...</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

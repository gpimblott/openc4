import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, AlertCircle, Loader2, Layers, Info } from 'lucide-react';

export interface WorkspaceSummary {
  id: number;
  name: string;
  description: string;
  state: string;
  version: string;
  updatedAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (workspaceId: number) => Promise<boolean>;
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: number;
}

export const DeleteWorkspaceModal: React.FC<Props> = (props) => {
  if (!props.isOpen) return null;
  return <DeleteWorkspaceDialog key={props.currentWorkspaceId} {...props} />;
};

const DeleteWorkspaceDialog: React.FC<Props> = ({
  onClose,
  onDelete,
  workspaces,
  currentWorkspaceId,
}) => {
  const [selectedId, setSelectedId] = useState<number>(currentWorkspaceId);
  const [confirmName, setConfirmName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const targetWs = workspaces.find((w) => w.id === selectedId) || workspaces[0];
  const isOnlyWorkspace = workspaces.length <= 1;
  const isConfirmed = targetWs && confirmName.trim() === targetWs.name.trim();

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWs) return;

    if (!isConfirmed) {
      setError(`Please type "${targetWs.name}" to confirm deletion.`);
      return;
    }

    setError(null);
    setIsDeleting(true);
    try {
      const success = await onDelete(targetWs.id);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Delete Workspace</h3>
              <p className="text-xs text-slate-400">
                Permanently delete an architecture workspace and its files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleDeleteSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Workspace if multiple exist */}
          {workspaces.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                <span>Select Workspace to Delete</span>
              </label>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(Number(e.target.value));
                  setConfirmName('');
                  setError(null);
                }}
                disabled={isDeleting}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 transition disabled:opacity-50 cursor-pointer"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id} className="bg-slate-900">
                    {w.name} ({w.state || 'DRAFT'} v{w.version || '1.0.0'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Workspace Details Card */}
          {targetWs && (
            <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm truncate">{targetWs.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {targetWs.state || 'DRAFT'} &bull; v{targetWs.version || '1.0.0'}
                </span>
              </div>
              {targetWs.description && (
                <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                  {targetWs.description}
                </p>
              )}
            </div>
          )}

          {/* Destructive Cascade Warning */}
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <span className="font-semibold text-rose-300 block">Irreversible Action</span>
              <span>
                Deleting this workspace will permanently destroy all its Structurizr DSL files, folders,
                layout arrangements, version history, and published catalog entries.
              </span>
            </div>
          </div>

          {/* Reset Notice if last workspace */}
          {isOnlyWorkspace && (
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/50 text-blue-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold text-blue-300 block">Only Workspace Notice</span>
                <span>
                  This is currently the only workspace in OpenC4. Deleting it will automatically create a
                  clean starter workspace so your architecture studio remains ready to use.
                </span>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          {targetWs && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-slate-300 block">
                To confirm deletion, please type{' '}
                <span className="font-bold font-mono text-rose-400 select-all">
                  {targetWs.name}
                </span>{' '}
                below:
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={targetWs.name}
                disabled={isDeleting}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 transition disabled:opacity-50 font-medium"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting || !isConfirmed}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-lg shadow-rose-600/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting Workspace...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

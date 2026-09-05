import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  nodesToDelete: Node[];
  edgesToDelete: Edge[];
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  nodesToDelete,
  edgesToDelete,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  const totalCount = nodesToDelete.length + edgesToDelete.length;
  if (totalCount === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Confirm Deletion</h3>
              <p className="text-xs text-slate-400">
                This will update both the graphical model and Structurizr DSL code.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-slate-300">
            Are you sure you want to permanently delete the following item{totalCount > 1 ? 's' : ''} from the architecture?
          </p>

          {/* Node items */}
          {nodesToDelete.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Elements to remove ({nodesToDelete.length})
              </span>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                {nodesToDelete.map((n) => {
                  const data = n.data as any;
                  return (
                    <div key={n.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                      <span className="font-semibold text-white">{data?.name || n.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {data?.type || 'Element'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edge items */}
          {edgesToDelete.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Relationships to remove ({edgesToDelete.length})
              </span>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1.5 max-h-32 overflow-y-auto">
                {edgesToDelete.map((e) => (
                  <div key={e.id} className="text-xs text-slate-300 font-mono py-0.5 truncate">
                    {e.source} &rarr; {e.target}
                    {e.label ? <span className="text-slate-400 italic"> ({e.label})</span> : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact Alert */}
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 block">Automatic Code Cascade</span>
              <span className="text-amber-200/90 leading-relaxed block">
                Deleting {nodesToDelete.length > 0 ? 'elements' : 'items'} will automatically remove their declarations, nested children, connected relationships, and invalid view references from your Structurizr DSL code to keep the model syntactically valid.
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-lg shadow-rose-600/30"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete from Model & Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

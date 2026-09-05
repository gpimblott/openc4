import React, { useState } from 'react';
import { RotateCcw, X, AlertTriangle, Calendar, FileText, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  version: string | null;
  versionDetails?: {
    commitMessage?: string;
    publishedAt?: string;
  };
  onRestore: (version: string) => Promise<boolean>;
}

export const RestoreVersionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  version,
  versionDetails,
  onRestore,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !version) return null;

  const handleConfirm = async () => {
    setIsRestoring(true);
    setError(null);
    try {
      const success = await onRestore(version);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to restore workspace version.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRestoring) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Restore Version Snapshot</h3>
              <p className="text-xs text-slate-400">
                Roll back active workspace DSL and diagrams to release <span className="text-purple-300 font-mono font-semibold">v{version}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Snapshot Summary Box */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
              <span className="text-slate-400">Target Release:</span>
              <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-purple-600/30 border border-purple-500/40 text-purple-200">
                v{version}
              </span>
            </div>

            {versionDetails?.publishedAt && (
              <div className="flex items-center justify-between border-b border-slate-800/70 pb-2 text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Published Date:</span>
                </span>
                <span className="font-mono text-[11px] text-slate-300">
                  {new Date(versionDetails.publishedAt).toLocaleString()}
                </span>
              </div>
            )}

            {versionDetails?.commitMessage && (
              <div className="space-y-1 pt-0.5">
                <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Release Notes:</span>
                </span>
                <p className="text-slate-200 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 leading-relaxed text-[11px]">
                  "{versionDetails.commitMessage}"
                </p>
              </div>
            )}
          </div>

          {/* Warning Banner */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 block">Overwrite Notice</span>
              <span className="text-amber-200/90 leading-relaxed text-[11px] block">
                Restoring this version will replace the active workspace Structurizr DSL code and node positions with the snapshot taken at v{version}.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRestoring}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition shadow-lg shadow-purple-600/30 disabled:opacity-50 cursor-pointer"
          >
            {isRestoring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Restoring...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore to v{version}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

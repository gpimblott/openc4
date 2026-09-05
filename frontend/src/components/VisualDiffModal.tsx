import React from 'react';
import { X, GitCompare, PlusCircle, AlertCircle, MinusCircle } from 'lucide-react';

interface DiffData {
  summary: {
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
  };
  addedElements: Array<{ key: string; name: string; type: string; details: any }>;
  modifiedElements: Array<{ key: string; name: string; type: string; changes: string[]; details: any }>;
  removedElements: Array<{ key: string; name: string; type: string; details: any }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  diff: DiffData | null;
  baseVersion: string;
  targetVersion: string;
  availableVersions?: string[];
  onVersionChange?: (v1: string, v2: string) => void;
}

export const VisualDiffModal: React.FC<Props> = ({
  isOpen,
  onClose,
  diff,
  baseVersion,
  targetVersion,
  availableVersions = [],
  onVersionChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Visual Architecture Diff</h2>
              {onVersionChange && availableVersions.length > 0 ? (
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                  <span>Base:</span>
                  <select
                    value={baseVersion.replace(/^Published \(v|\)$|^v/g, '')}
                    onChange={(e) => onVersionChange(e.target.value, targetVersion.includes('Draft') ? 'draft' : targetVersion.replace(/^Published \(v|\)$|^v/g, ''))}
                    className="bg-slate-800 border border-slate-700 text-purple-300 font-mono text-[11px] rounded px-2 py-0.5 focus:outline-none"
                  >
                    {availableVersions.map((ver) => (
                      <option key={ver} value={ver}>
                        v{ver}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-500">vs</span>

                  <span>Target:</span>
                  <select
                    value={targetVersion.includes('Draft') ? 'draft' : targetVersion.replace(/^Published \(v|\)$|^v/g, '')}
                    onChange={(e) => onVersionChange(baseVersion.replace(/^Published \(v|\)$|^v/g, ''), e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-purple-300 font-mono text-[11px] rounded px-2 py-0.5 focus:outline-none"
                  >
                    <option value="draft">Current Workspace</option>
                    {availableVersions.map((ver) => (
                      <option key={ver} value={ver}>
                        v{ver}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Comparing <span className="text-purple-300 font-mono">{baseVersion}</span> with{' '}
                  <span className="text-purple-300 font-mono">{targetVersion}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Badges */}
        {diff && (
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-950/30 border-b border-slate-800 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <PlusCircle className="w-4 h-4" /> {diff.summary.addedCount} Added
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertCircle className="w-4 h-4" /> {diff.summary.modifiedCount} Modified
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <MinusCircle className="w-4 h-4" /> {diff.summary.removedCount} Removed
            </span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!diff || (diff.summary.addedCount === 0 && diff.summary.modifiedCount === 0 && diff.summary.removedCount === 0) ? (
            <div className="text-center py-12 text-slate-500">
              <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-300">No differences detected</p>
              <p className="text-xs mt-1">Both architecture versions are identical.</p>
            </div>
          ) : (
            <>
              {/* Added */}
              {diff.addedElements.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Added Elements
                  </h4>
                  <div className="space-y-2">
                    {diff.addedElements.map((elem, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs"
                      >
                        <div className="font-semibold text-emerald-200">{elem.name}</div>
                        <div className="text-emerald-400/80 mt-0.5">
                          Type: {elem.type} {elem.details?.technology && `[${elem.details.technology}]`}
                        </div>
                        {elem.details?.description && (
                          <div className="text-slate-300 italic mt-1">{elem.details.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modified */}
              {diff.modifiedElements.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Modified Elements
                  </h4>
                  <div className="space-y-2">
                    {diff.modifiedElements.map((elem, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs"
                      >
                        <div className="font-semibold text-amber-200">{elem.name}</div>
                        <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-300/80">
                          {elem.changes.map((ch, cidx) => (
                            <li key={cidx}>{ch}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed */}
              {diff.removedElements.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-1.5">
                    <MinusCircle className="w-3.5 h-3.5" /> Removed Elements
                  </h4>
                  <div className="space-y-2">
                    {diff.removedElements.map((elem, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs"
                      >
                        <div className="font-semibold text-rose-200 line-through">{elem.name}</div>
                        <div className="text-rose-400/80 mt-0.5">Type: {elem.type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

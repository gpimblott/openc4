import React from 'react';
import { X, ShieldAlert, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export interface InspectionFinding {
  ruleId: string;
  severity: string;
  message: string;
  elementId?: string;
  elementType?: string;
  elementName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  findings: InspectionFinding[];
  onSelectElement?: (elementId: string) => void;
}

export const InspectionDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  findings,
  onSelectElement,
}) => {
  if (!isOpen) return null;

  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARNING');
  const infos = findings.filter((f) => f.severity === 'INFO');

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base">Model Quality & Inspection</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Pills */}
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-950/30 border-b border-slate-800 text-xs">
        <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30 font-medium">
          {errors.length} Errors
        </span>
        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 font-medium">
          {warnings.length} Warnings
        </span>
        <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30 font-medium">
          {infos.length} Suggestions
        </span>
      </div>

      {/* Findings List */}
      <div className="p-4 overflow-y-auto flex-1 space-y-3">
        {findings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="font-semibold text-emerald-300">Clean Architecture!</p>
            <p className="text-xs mt-1 text-slate-400">
              No rule violations or missing descriptions detected in this workspace.
            </p>
          </div>
        ) : (
          findings.map((f, idx) => {
            const isErr = f.severity === 'ERROR';
            const isWarn = f.severity === 'WARNING';
            return (
              <div
                key={idx}
                onClick={() => f.elementId && onSelectElement && onSelectElement(f.elementId)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                  isErr
                    ? 'bg-rose-950/30 border-rose-800/50 hover:border-rose-600'
                    : isWarn
                    ? 'bg-amber-950/30 border-amber-800/50 hover:border-amber-600'
                    : 'bg-blue-950/30 border-blue-800/50 hover:border-blue-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {isErr ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span
                    className={
                      isErr
                        ? 'text-rose-300'
                        : isWarn
                        ? 'text-amber-300'
                        : 'text-blue-300'
                    }
                  >
                    {f.ruleId}
                  </span>
                </div>
                <div className="text-slate-200">{f.message}</div>
                {f.elementName && (
                  <div className="mt-1.5 text-slate-400 text-[11px]">
                    Element: <span className="text-slate-300 font-mono">{f.elementName}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

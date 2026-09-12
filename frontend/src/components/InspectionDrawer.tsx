import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, Info, AlertCircle, Eye, BookOpen } from 'lucide-react';

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
  terminology?: Record<string, string>;
  nodes?: Array<{ id: string; [key: string]: any }>;
  edges?: Array<{ id: string; [key: string]: any }>;
  onSelectElement?: (elementId: string) => void;
}

export const InspectionDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  findings,
  terminology,
  nodes = [],
  edges = [],
  onSelectElement,
}) => {
  const [activeTab, setActiveTab] = useState<'quality' | 'perspectives'>('quality');

  if (!isOpen) return null;

  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARNING');
  const infos = findings.filter((f) => f.severity === 'INFO');

  // Collect perspectives across nodes and edges
  const elementPerspectives: Array<{
    targetName: string;
    targetType: string;
    perspectives: Array<{ name: string; description?: string; value?: string }>;
  }> = [];

  for (const n of nodes) {
    if (n.data?.perspectives && n.data.perspectives.length > 0) {
      elementPerspectives.push({
        targetName: n.data.name || n.id,
        targetType: n.data.type || 'Element',
        perspectives: n.data.perspectives,
      });
    }
  }

  for (const e of edges) {
    if (e.data?.perspectives && e.data.perspectives.length > 0) {
      elementPerspectives.push({
        targetName: e.data.description || e.label || `${e.source} -> ${e.target}`,
        targetType: 'Relationship',
        perspectives: e.data.perspectives,
      });
    }
  }

  const terminologyEntries = Object.entries(terminology || {}).filter(
    ([, v]) => typeof v === 'string' && v.trim().length > 0
  );

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base">Model Inspection</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
        <button
          onClick={() => setActiveTab('quality')}
          className={`flex-1 py-2.5 px-3 font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'quality'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Quality ({findings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('perspectives')}
          className={`flex-1 py-2.5 px-3 font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'perspectives'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Perspectives ({elementPerspectives.length})</span>
        </button>
      </div>

      {activeTab === 'quality' ? (
        <>
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
        </>
      ) : (
        /* Terminology & Perspectives Tab */
        <div className="p-4 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Terminology Section */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Configured Terminology</span>
            </div>
            {terminologyEntries.length === 0 ? (
              <p className="text-slate-400 text-xs italic bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                Standard C4 terminology in use (Person, Software System, Container, Component).
              </p>
            ) : (
              <div className="space-y-1.5">
                {terminologyEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800"
                  >
                    <span className="text-slate-400 capitalize">{k}</span>
                    <span className="font-semibold text-cyan-300 font-mono">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Perspectives Section */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Model Perspectives</span>
            </div>
            {elementPerspectives.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 p-4">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-medium text-slate-300">No Perspectives Configured</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Attach architectural dimensions (e.g. Security, Cost, Performance) to elements using the{' '}
                  <code className="text-cyan-300 bg-slate-800 px-1 py-0.5 rounded">perspectives</code> block.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {elementPerspectives.map((ep, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-semibold text-slate-200">{ep.targetName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        {ep.targetType}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {ep.perspectives.map((p, pIdx) => (
                        <div key={pIdx} className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-amber-300">{p.name}</span>
                            {p.value && (
                              <span className="text-cyan-300 font-mono text-[11px]">{p.value}</span>
                            )}
                          </div>
                          {p.description && (
                            <div className="text-slate-400 text-[11px] mt-0.5">{p.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

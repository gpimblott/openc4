import { useState, useRef, useEffect } from 'react';
import {
  Wrench,
  ShieldAlert,
  GitCompare,
  Cpu,
  UploadCloud,
  ChevronDown,
} from 'lucide-react';

interface ToolsMenuProps {
  findingsCount: number;
  onOpenInspection: () => void;
  onOpenDiff: () => void;
  onOpenMcpValidation: () => void;
  onOpenPublish: () => void;
}

export function ToolsMenu({
  findingsCount,
  onOpenInspection,
  onOpenDiff,
  onOpenMcpValidation,
  onOpenPublish,
}: ToolsMenuProps) {
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

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Architecture analysis and quality tools"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
          findingsCount > 0
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
        }`}
      >
        {findingsCount > 0 ? (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        )}
        <span>Tools</span>
        {findingsCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 border border-amber-500/40 font-mono font-bold text-amber-300">
            {findingsCount}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
            Analysis & Verification
          </div>

          {/* Architecture Inspection */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenInspection();
            }}
            className="w-full text-left p-2 rounded-lg flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer group"
          >
            <div className="p-1.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25 mt-0.5 group-hover:bg-amber-500/25">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100 group-hover:text-white">
                  Architecture Inspection
                </span>
                {findingsCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                    {findingsCount} {findingsCount === 1 ? 'finding' : 'findings'}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-medium">Clean</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Detect rule violations, cyclic dependencies & antipatterns
              </p>
            </div>
          </button>

          {/* Visual Diff */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenDiff();
            }}
            className="w-full text-left p-2 rounded-lg flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer group"
          >
            <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25 mt-0.5 group-hover:bg-purple-500/25">
              <GitCompare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 group-hover:text-white">
                Visual & Architecture Diff
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Compare current DSL & canvas layout against base snapshot
              </p>
            </div>
          </button>

          {/* MCP Validate */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenMcpValidation();
            }}
            className="w-full text-left p-2 rounded-lg flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer group"
          >
            <div className="p-1.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 mt-0.5 group-hover:bg-cyan-500/25">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 group-hover:text-white">
                MCP DSL Validation
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Validate syntax and model against local Structurizr MCP server
              </p>
            </div>
          </button>

          {/* Publish to Structurizr */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenPublish();
            }}
            className="w-full text-left p-2 rounded-lg flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer group border-t border-slate-800/80 pt-2 mt-1"
          >
            <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25 mt-0.5 group-hover:bg-purple-500/25">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 group-hover:text-white">
                Publish to Structurizr
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Publish architecture model to local Structurizr Playground or Lite
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

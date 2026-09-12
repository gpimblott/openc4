import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileCode, Layers, FileText, Code2 } from 'lucide-react';

interface ExportMenuProps {
  workspaceId: number | null;
  currentViewKey: string;
  onOpenExportModal: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

export function ExportMenu({
  workspaceId,
  currentViewKey,
  onOpenExportModal,
  authFetch,
  onShowToast,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleQuickDownload = async (format: 'mermaid' | 'plantuml' | 'json' | 'dsl') => {
    if (!workspaceId) return;
    setIsExporting(true);
    try {
      const res = await authFetch(
        `/api/workspaces/${workspaceId}/export?format=${format}&viewKey=${currentViewKey}`
      );
      if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
      const content = await res.text();

      const extMap = { mermaid: 'mmd', plantuml: 'puml', json: 'json', dsl: 'dsl' };
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace_${workspaceId}_${currentViewKey || 'diagram'}.${extMap[format]}`;
      a.click();
      URL.revokeObjectURL(url);

      if (onShowToast) {
        onShowToast(`Exported ${format.toUpperCase()} successfully`, 'success');
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Export failed: ${err.message}`, 'error');
      }
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        title="Export Architecture and Diagrams"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Export</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
            Export Diagrams
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenExportModal();
            }}
            className="w-full text-left p-2 rounded-lg flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer group"
          >
            <div className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 mt-0.5 group-hover:bg-emerald-500/25">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 group-hover:text-white">
                Export Dialog & Preview...
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Interactive preview and clipboard copy in all formats
              </p>
            </div>
          </button>

          <div className="my-1 border-t border-slate-800" />
          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Quick Download ({currentViewKey || 'Current View'})
          </div>

          <button
            type="button"
            onClick={() => handleQuickDownload('mermaid')}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Mermaid Diagram</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">.mmd</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDownload('plantuml')}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>PlantUML</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">.puml</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDownload('dsl')}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Structurizr DSL</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">.dsl</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDownload('json')}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <span>JSON Workspace</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">.json</span>
          </button>
        </div>
      )}
    </div>
  );
}

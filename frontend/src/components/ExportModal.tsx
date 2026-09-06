import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  currentViewKey: string;
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  workspaceId,
  currentViewKey,
}) => {
  const { authFetch } = useAuth();
  const [format, setFormat] = useState<'mermaid' | 'plantuml' | 'json' | 'dsl'>('mermaid');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    authFetch(`/api/workspaces/${workspaceId}/export?format=${format}&viewKey=${currentViewKey}`)
      .then((res) => res.text())
      .then((data) => {
        setContent(data);
        setLoading(false);
      })
      .catch((err) => {
        setContent(`// Error fetching export: ${err.message}`);
        setLoading(false);
      });
  }, [isOpen, format, workspaceId, currentViewKey]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extMap = { mermaid: 'mmd', plantuml: 'puml', json: 'json', dsl: 'dsl' };
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_${workspaceId}_${currentViewKey}.${extMap[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Export Architecture Model</h2>
              <p className="text-xs text-slate-400">
                Export <span className="text-emerald-300 font-semibold">{currentViewKey}</span> to multiple diagrams-as-code formats
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 p-4 border-b border-slate-800 bg-slate-950/20">
          {[
            { id: 'mermaid', label: 'Mermaid' },
            { id: 'plantuml', label: 'C4-PlantUML' },
            { id: 'json', label: 'Structurizr JSON' },
            { id: 'dsl', label: 'Structurizr DSL' },
          ].map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setFormat(fmt.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                format === fmt.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {fmt.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Code Preview */}
        <div className="p-4 flex-1 overflow-hidden bg-slate-950 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center flex-1 text-slate-400 text-xs">
              Compiling export...
            </div>
          ) : (
            <pre className="flex-1 overflow-auto p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-emerald-300 leading-relaxed select-all">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

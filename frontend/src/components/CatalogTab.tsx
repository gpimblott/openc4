import React, { useState } from 'react';
import { Search, Server, Box, Copy, Check, Plus, RefreshCw, Layers } from 'lucide-react';

export interface CatalogItem {
  id: string;
  workspaceId: number;
  name: string;
  description: string;
  tags: string;
  containers: Array<{ id: string; name: string; technology?: string; description?: string }>;
  version: string;
  updatedAt: string;
}

interface Props {
  catalog: CatalogItem[];
  onRefresh: () => void;
  onInsertDsl: (snippet: string) => void;
}

export const CatalogTab: React.FC<Props> = ({ catalog, onRefresh, onInsertDsl }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filtered = catalog.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.tags && item.tags.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.containers && item.containers.some(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.technology && c.technology.toLowerCase().includes(searchTerm.toLowerCase()))
    ))
  );

  const generateSnippet = (item: CatalogItem) => {
    const ident = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${ident} = softwareSystem "${item.name}" "${item.description || ''}" "${item.tags || 'External System'}"`;
  };

  const handleCopy = (item: CatalogItem) => {
    const snippet = generateSnippet(item);
    navigator.clipboard.writeText(snippet);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (item: CatalogItem) => {
    const snippet = generateSnippet(item);
    onInsertDsl(snippet);
    setInsertedId(item.id);
    setTimeout(() => setInsertedId(null), 2000);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search enterprise catalog systems, tags, containers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-850 border border-slate-750 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={handleManualRefresh}
          title="Refresh enterprise catalog"
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      {/* Catalog Subheader info */}
      <div className="px-3 py-1.5 bg-slate-900/20 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-blue-400" />
          <span>{catalog.length} published enterprise system{catalog.length === 1 ? '' : 's'}</span>
        </span>
        {searchTerm && (
          <span className="text-slate-500">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {/* Catalog Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-xs text-slate-400">
              {catalog.length === 0 ? 'No systems published in Catalog yet' : 'No matching systems found'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
              {catalog.length === 0
                ? 'Publish your architecture workspaces to register reusable systems in the enterprise catalog.'
                : 'Try adjusting your search keywords.'}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition flex flex-col gap-2.5 shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-white text-xs">{item.name}</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-mono bg-blue-500/15 text-blue-300 rounded border border-blue-500/20">
                      v{item.version}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">{item.description}</p>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(item)}
                    title="Copy DSL snippet to clipboard"
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleInsert(item)}
                    title="Insert directly into DSL model block"
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-md border border-blue-500/30 transition"
                  >
                    {insertedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Inserted!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Insert</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tags */}
              {item.tags && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.split(',').map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-400 rounded"
                    >
                      {t.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Containers & Services breakdown */}
              {item.containers && item.containers.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Containers ({item.containers.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.containers.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-300"
                      >
                        <Box className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="font-medium text-slate-200">{c.name}</span>
                        {c.technology && (
                          <span className="text-slate-500 text-[10px]">({c.technology})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

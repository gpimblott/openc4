import React, { useState } from 'react';
import { X, Search, Server, Box, Copy, Check } from 'lucide-react';

interface CatalogItem {
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
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  currentWorkspaceId?: number;
}

export const EnterpriseCatalogModal: React.FC<Props> = ({ isOpen, onClose, catalog, currentWorkspaceId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const workspaceCatalogItems = currentWorkspaceId
    ? catalog.filter((item) => item.workspaceId === currentWorkspaceId)
    : catalog;

  const latestCatalogItems = Object.values(
    workspaceCatalogItems.reduce((acc: Record<string, CatalogItem>, item) => {
      const existing = acc[item.name];
      if (!existing) {
        acc[item.name] = item;
      } else {
        const partsA = (item.version || '').replace(/^v/, '').split('.').map((p) => parseInt(p, 10));
        const partsB = (existing.version || '').replace(/^v/, '').split('.').map((p) => parseInt(p, 10));
        let isItemNewer = false;
        const maxLen = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < maxLen; i++) {
          const numA = isNaN(partsA[i]) ? 0 : partsA[i];
          const numB = isNaN(partsB[i]) ? 0 : partsB[i];
          if (numA > numB) {
            isItemNewer = true;
            break;
          }
          if (numA < numB) {
            isItemNewer = false;
            break;
          }
        }
        if (isItemNewer || (!partsA.some((p, idx) => p !== partsB[idx]) && new Date(item.updatedAt) > new Date(existing.updatedAt))) {
          acc[item.name] = item;
        }
      }
      return acc;
    }, {})
  );

  const filtered = latestCatalogItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.tags.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyRefSnippet = (item: CatalogItem) => {
    const snippet = `// Reference from Enterprise Catalog:\nsoftwareSystem "${item.name}" "${item.description}" "${item.tags}"`;
    navigator.clipboard.writeText(snippet);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Enterprise Model Catalog</h2>
              <p className="text-xs text-slate-400">
                Federated repository of published software systems across the enterprise
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

        {/* Search Bar */}
        <div className="p-6 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search enterprise systems, containers, or technology tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>
        </div>

        {/* Catalog List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No enterprise systems match your query</p>
              <p className="text-xs mt-1">Publish workspaces to make systems discoverable across the organization.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-base">{item.name}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                        v{item.version}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">{item.description}</p>
                    {item.tags && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {item.tags.split(',').map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-slate-700/60 text-slate-300 rounded-md"
                          >
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => copyRefSnippet(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition shrink-0"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Ref</span>
                      </>
                    )}
                  </button>
                </div>

                {item.containers && item.containers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700/60">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Containers & Services ({item.containers.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.containers.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 border border-slate-700/40 text-xs text-slate-300"
                        >
                          <Box className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-medium text-white">{c.name}</span>
                          {c.technology && (
                            <span className="text-slate-400 ml-auto">[{c.technology}]</span>
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
    </div>
  );
};

import { FileCode, X, Plus, Star, AlertCircle, PanelLeftOpen } from 'lucide-react';

interface EditorTabsProps {
  openTabs: string[];
  activeTab: string;
  entryPoint: string;
  errorFile?: string | null;
  dirtyFiles?: Set<string>;
  isFileTreeCollapsed: boolean;
  onSelectTab: (tab: string) => void;
  onCloseTab: (tab: string, e: React.MouseEvent) => void;
  onNewFile: () => void;
  onToggleFileTree: () => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openTabs,
  activeTab,
  entryPoint,
  errorFile,
  dirtyFiles = new Set(),
  isFileTreeCollapsed,
  onSelectTab,
  onCloseTab,
  onNewFile,
  onToggleFileTree
}) => {
  return (
    <div className="flex items-center bg-slate-950/70 border-b border-slate-800 text-xs overflow-x-auto select-none no-scrollbar">
      {/* Sidebar expand button when file tree is collapsed */}
      {isFileTreeCollapsed && (
        <button
          type="button"
          onClick={onToggleFileTree}
          title="Show File Explorer"
          className="px-2.5 py-2 text-slate-400 hover:text-white hover:bg-slate-900 border-r border-slate-800 transition-colors flex items-center justify-center shrink-0"
        >
          <PanelLeftOpen size={14} />
        </button>
      )}

      {/* Tabs list */}
      <div className="flex items-center flex-1 overflow-x-auto">
        {(openTabs.includes(entryPoint) ? openTabs : [entryPoint, ...openTabs]).map((tab) => {
          const isActive = tab === activeTab;
          const isEntry = tab === entryPoint;
          const hasError = tab === errorFile;
          const isDirty = dirtyFiles.has(tab);
          const parts = tab.split('/');
          const displayName = parts[parts.length - 1];

          return (
            <div
              key={tab}
              onClick={() => onSelectTab(tab)}
              title={isEntry ? `${tab} (Root Entry Point)` : tab}
              className={`group flex items-center gap-1.5 px-3 py-2 border-r border-slate-800 cursor-pointer font-mono transition-colors shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white font-medium border-t-2 border-t-blue-500'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border-t-2 border-t-transparent'
              }`}
            >
              <FileCode size={13} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
              <span className="truncate max-w-[140px]">{displayName}</span>

              {isEntry && (
                <span title="Entry Point (workspace.dsl)">
                  <Star size={11} className="text-amber-400 fill-amber-400/30 shrink-0" />
                </span>
              )}

              {hasError && (
                <span title="Error in this file">
                  <AlertCircle size={11} className="text-rose-400 shrink-0" />
                </span>
              )}

              {isDirty && !hasError && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="Unsaved changes" />
              )}

              {!isEntry && openTabs.length > 1 && (
                <button
                  type="button"
                  title="Close tab"
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-opacity ml-0.5"
                  onClick={(e) => onCloseTab(tab, e)}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        {/* Quick add file tab */}
        <button
          type="button"
          onClick={onNewFile}
          title="New file"
          className="px-2.5 py-2 text-slate-500 hover:text-white hover:bg-slate-900 transition-colors flex items-center shrink-0"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Plus,
  Eye,
  Sparkles,
  User,
  Box,
  Layers,
  Cpu,
  Cloud,
  GripVertical,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type PaletteElementType = 'person' | 'softwareSystem' | 'container' | 'component' | 'infrastructureNode';

export interface ModelElementSummary {
  id: string;
  identifier: string;
  name: string;
  type: 'person' | 'softwareSystem' | 'container' | 'component' | 'infrastructureNode';
  description?: string;
  technology?: string;
  parentId?: string;
  tags?: string[];
}

interface CanvasNodePaletteProps {
  onOpenAddElement: () => void;
  onOpenAddView: () => void;
  unplacedElements?: ModelElementSummary[];
  onIncludeElement?: (elem: ModelElementSummary) => void;
  canEdit?: boolean;
}

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  person: {
    icon: User,
    color: 'text-blue-300',
    bg: 'bg-[#08427b]/20',
    border: 'border-blue-500/30',
  },
  softwareSystem: {
    icon: Box,
    color: 'text-sky-300',
    bg: 'bg-[#1168bd]/20',
    border: 'border-sky-500/30',
  },
  container: {
    icon: Layers,
    color: 'text-cyan-300',
    bg: 'bg-[#438dd5]/20',
    border: 'border-cyan-500/30',
  },
  component: {
    icon: Cpu,
    color: 'text-indigo-300',
    bg: 'bg-[#85bbf0]/20',
    border: 'border-indigo-500/30',
  },
  infrastructureNode: {
    icon: Cloud,
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
  },
};

export const CanvasNodePalette: React.FC<CanvasNodePaletteProps> = ({
  onOpenAddElement,
  onOpenAddView,
  unplacedElements = [],
  onIncludeElement,
  canEdit = true,
}) => {
  const [isUnplacedExpanded, setIsUnplacedExpanded] = useState<boolean>(true);

  if (!canEdit) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl transition-all select-none w-52 max-h-[85vh] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-0.5">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Canvas Actions</span>
      </div>

      {/* Create Element Button */}
      <button
        type="button"
        onClick={onOpenAddElement}
        title="Add Person, Software System, Container, Component, or Infrastructure Node (Shortcut: E)"
        className="group flex items-center justify-between p-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition cursor-pointer text-left shadow-xs shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 group-hover:bg-cyan-500/30 shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-white group-hover:text-cyan-200 truncate">
              Create Element
            </div>
            <div className="text-[10px] text-cyan-300/70 truncate">
              Person, System...
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-slate-950/70 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800 shrink-0 ml-1">
          E
        </span>
      </button>

      {/* Create View Button */}
      <button
        type="button"
        onClick={onOpenAddView}
        title="Create System Context, Container, Component, or Landscape View (Shortcut: V)"
        className="group flex items-center justify-between p-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition cursor-pointer text-left shadow-xs shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 group-hover:bg-purple-500/30 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-white group-hover:text-purple-200 truncate">
              Create View
            </div>
            <div className="text-[10px] text-purple-300/70 truncate">
              Context, Container...
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-slate-950/70 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800 shrink-0 ml-1">
          V
        </span>
      </button>

      {/* Unplaced DSL Elements Drawer */}
      <div className="mt-1 pt-1.5 border-t border-slate-800/80 flex flex-col min-h-0">
        <button
          type="button"
          onClick={() => setIsUnplacedExpanded(!isUnplacedExpanded)}
          className="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <span>DSL Elements</span>
            {unplacedElements.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                {unplacedElements.length}
              </span>
            )}
          </div>
          {isUnplacedExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {isUnplacedExpanded && (
          <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-56 pr-0.5 text-xs">
            {unplacedElements.length > 0 ? (
              <>
                <div className="text-[10px] text-slate-500 px-1 mb-0.5">
                  Drag onto canvas to place:
                </div>
                {unplacedElements.map((elem) => {
                  const conf = TYPE_ICONS[elem.type] || TYPE_ICONS.softwareSystem;
                  const Icon = conf.icon;
                  return (
                    <div
                      key={`${elem.type}_${elem.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/openc4-element', JSON.stringify(elem));
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      title={`Drag onto canvas or click + to add "${elem.name}"`}
                      className={`group flex items-center justify-between p-1.5 rounded-lg border ${conf.border} ${conf.bg} hover:bg-slate-800/80 transition cursor-grab active:cursor-grabbing shadow-xs`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0" />
                        <div className={`p-1 rounded border shrink-0 ${conf.bg} ${conf.border} ${conf.color}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-200 group-hover:text-white truncate">
                            {elem.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {elem.type === 'softwareSystem' ? 'System' : elem.type === 'person' ? 'Person' : elem.type}
                          </div>
                        </div>
                      </div>

                      {onIncludeElement && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onIncludeElement(elem);
                          }}
                          title="Add to current view"
                          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60 transition cursor-pointer shrink-0 ml-1 opacity-80 group-hover:opacity-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-[10px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>All DSL elements on canvas</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

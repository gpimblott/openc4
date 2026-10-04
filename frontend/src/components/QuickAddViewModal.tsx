import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Compass,
  Box,
  Layers,
  Cpu,
  Cloud,
} from 'lucide-react';

export type ViewTypeOption = 'systemContext' | 'container' | 'component' | 'systemLandscape' | 'deployment';

export interface AddViewFormData {
  viewType: ViewTypeOption;
  targetId?: string;
  key: string;
  title?: string;
  description?: string;
  autoLayout: 'lr' | 'tb' | 'bt' | 'rl' | 'none';
}

interface ElementOption {
  id: string;
  identifier: string;
  name: string;
  systemId?: string;
}

interface QuickAddViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddViewFormData) => void;
  isAdding?: boolean;
  systems?: ElementOption[];
  containers?: ElementOption[];
  defaultSystemId?: string;
  defaultContainerId?: string;
}

const VIEW_TYPE_CONFIG = {
  systemLandscape: {
    label: 'System Landscape',
    subtitle: 'High-level overview of all people and software systems in the enterprise',
    icon: Compass,
    requiresTarget: false,
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    activeColor: 'bg-emerald-600 text-white',
    defaultLayout: 'lr' as const,
  },
  systemContext: {
    label: 'System Context',
    subtitle: 'Zoom in on a single software system showing users and external dependencies',
    icon: Box,
    requiresTarget: true,
    targetLabel: 'Target Software System',
    color: 'bg-[#1168bd]/20 text-sky-300 border-sky-500/40',
    activeColor: 'bg-sky-600 text-white',
    defaultLayout: 'lr' as const,
  },
  container: {
    label: 'Container Diagram',
    subtitle: 'Decompose a software system into applications, APIs, databases, and microservices',
    icon: Layers,
    requiresTarget: true,
    targetLabel: 'Target Software System',
    color: 'bg-[#438dd5]/20 text-cyan-300 border-cyan-500/40',
    activeColor: 'bg-cyan-600 text-white',
    defaultLayout: 'tb' as const,
  },
  component: {
    label: 'Component Diagram',
    subtitle: 'Decompose a container into its internal components, services, and controllers',
    icon: Cpu,
    requiresTarget: true,
    targetLabel: 'Target Container',
    color: 'bg-[#85bbf0]/20 text-indigo-300 border-indigo-500/40',
    activeColor: 'bg-indigo-600 text-white',
    defaultLayout: 'tb' as const,
  },
  deployment: {
    label: 'Deployment Diagram',
    subtitle: 'Mapping containers to physical/cloud infrastructure nodes and environments',
    icon: Cloud,
    requiresTarget: false,
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    activeColor: 'bg-purple-600 text-white',
    defaultLayout: 'tb' as const,
  },
};

export const QuickAddViewModal: React.FC<QuickAddViewModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  isAdding = false,
  systems = [],
  containers = [],
  defaultSystemId,
  defaultContainerId,
}) => {
  if (!isOpen) return null;

  return (
    <QuickAddViewModalContent
      isOpen={isOpen}
      onClose={onClose}
      onAdd={onAdd}
      isAdding={isAdding}
      systems={systems}
      containers={containers}
      defaultSystemId={defaultSystemId}
      defaultContainerId={defaultContainerId}
    />
  );
};

const QuickAddViewModalContent: React.FC<QuickAddViewModalProps> = ({
  onClose,
  onAdd,
  isAdding = false,
  systems = [],
  containers = [],
  defaultSystemId,
  defaultContainerId,
}) => {
  const [viewType, setViewType] = useState<ViewTypeOption>('container');
  const [targetId, setTargetId] = useState<string>(() => {
    if (defaultSystemId) return defaultSystemId;
    if (systems.length > 0) return systems[0].identifier || systems[0].id;
    return '';
  });
  const [key, setKey] = useState<string>('');
  const [isKeyManual, setIsKeyManual] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [autoLayout, setAutoLayout] = useState<'lr' | 'tb' | 'bt' | 'rl' | 'none'>('tb');

  // Auto-generate key when type or target changes
  useEffect(() => {
    if (!isKeyManual) {
      if (viewType === 'systemLandscape') {
        setKey('SystemLandscape');
      } else if (viewType === 'deployment') {
        setKey('Deployment_Live');
      } else if (viewType === 'systemContext') {
        const sys = systems.find((s) => s.identifier === targetId || s.id === targetId);
        const namePart = sys ? sys.identifier || sys.id : 'System';
        setKey(`SystemContext_${namePart}`);
      } else if (viewType === 'container') {
        const sys = systems.find((s) => s.identifier === targetId || s.id === targetId);
        const namePart = sys ? sys.identifier || sys.id : 'System';
        setKey(`Containers_${namePart}`);
      } else if (viewType === 'component') {
        const cont = containers.find((c) => c.identifier === targetId || c.id === targetId);
        const namePart = cont ? cont.identifier || cont.id : 'Container';
        setKey(`Components_${namePart}`);
      }
    }
  }, [viewType, targetId, systems, containers, isKeyManual]);

  // Adjust target when switching to component vs system views
  useEffect(() => {
    if (viewType === 'component') {
      if (defaultContainerId && containers.some((c) => c.identifier === defaultContainerId || c.id === defaultContainerId)) {
        setTargetId(defaultContainerId);
      } else if (containers.length > 0) {
        setTargetId(containers[0].identifier || containers[0].id);
      }
    } else if (viewType === 'systemContext' || viewType === 'container') {
      if (defaultSystemId && systems.some((s) => s.identifier === defaultSystemId || s.id === defaultSystemId)) {
        setTargetId(defaultSystemId);
      } else if (systems.length > 0) {
        setTargetId(systems[0].identifier || systems[0].id);
      }
    }
  }, [viewType, defaultContainerId, defaultSystemId, systems, containers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    onAdd({
      viewType,
      targetId: VIEW_TYPE_CONFIG[viewType].requiresTarget ? targetId : undefined,
      key: key.trim(),
      description: description.trim(),
      autoLayout,
    });
  };

  const currentConfig = VIEW_TYPE_CONFIG[viewType];
  const Icon = currentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${currentConfig.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Create Diagram View
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {currentConfig.label}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentConfig.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* View Type Grid */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              View Level
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(VIEW_TYPE_CONFIG) as ViewTypeOption[]).map((vt) => {
                const conf = VIEW_TYPE_CONFIG[vt];
                const VIcon = conf.icon;
                const isSelected = viewType === vt;
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => {
                      setViewType(vt);
                      setAutoLayout(conf.defaultLayout);
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-purple-500 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg border shrink-0 ${
                        isSelected ? conf.activeColor : conf.color
                      }`}
                    >
                      <VIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-semibold text-xs ${
                          isSelected ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {conf.label}
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {conf.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Element Selector */}
          {(viewType === 'systemContext' || viewType === 'container') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Software System <span className="text-rose-400">*</span>
              </label>
              {systems.length > 0 ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.identifier || s.id}>
                      {s.name} ({s.identifier || s.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  No software systems found in model. Create a Software System first!
                </div>
              )}
            </div>
          )}

          {viewType === 'component' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Container <span className="text-rose-400">*</span>
              </label>
              {containers.length > 0 ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                >
                  {containers.map((c) => (
                    <option key={c.id} value={c.identifier || c.id}>
                      {c.name} ({c.identifier || c.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  No containers found in model. Create a Container first!
                </div>
              )}
            </div>
          )}

          {/* View Key & AutoLayout Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                View Key <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  setIsKeyManual(true);
                  setKey(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''));
                }}
                placeholder="e.g. SystemContext_Main"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Auto-Layout Direction
              </label>
              <select
                value={autoLayout}
                onChange={(e) => setAutoLayout(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="lr">Left to Right (LR)</option>
                <option value="tb">Top to Bottom (TB)</option>
                <option value="bt">Bottom to Top (BT)</option>
                <option value="rl">Right to Left (RL)</option>
                <option value="none">Manual / Free Placement</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Component architecture of the Core API service."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding || !key.trim() || (currentConfig.requiresTarget && !targetId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-purple-600/30 transition cursor-pointer"
            >
              {isAdding ? (
                <span>Creating...</span>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Create View in DSL</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

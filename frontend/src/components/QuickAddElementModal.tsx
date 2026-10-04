import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  User,
  Box,
  Layers,
  Cpu,
  Cloud,
} from 'lucide-react';
import type { PaletteElementType } from './CanvasNodePalette';

export interface AddElementFormData {
  type: PaletteElementType;
  name: string;
  identifier: string;
  description: string;
  technology: string;
  tags: string;
  parentId?: string;
  location?: string;
  createDefaultView: boolean;
}

interface ParentOption {
  id: string;
  identifier: string;
  name: string;
  systemId?: string;
}

interface QuickAddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddElementFormData) => void;
  isAdding?: boolean;
  initialType?: PaletteElementType;
  systems?: ParentOption[];
  containers?: ParentOption[];
  defaultParentId?: string;
}

const TYPE_CONFIG = {
  person: {
    label: 'Person',
    subtitle: 'Human user, customer, or internal role',
    icon: User,
    color: 'bg-[#08427b]/20 text-blue-300 border-blue-500/40',
    activeColor: 'bg-blue-600 text-white border-blue-400',
    descPlaceholder: 'e.g. A personal banking customer with open accounts.',
    techPlaceholder: 'N/A',
  },
  softwareSystem: {
    label: 'Software System',
    subtitle: 'High-level software application or system',
    icon: Box,
    color: 'bg-[#1168bd]/20 text-sky-300 border-sky-500/40',
    activeColor: 'bg-sky-600 text-white border-sky-400',
    descPlaceholder: 'e.g. Allows customers to manage accounts and transfer money.',
    techPlaceholder: 'Optional (e.g. SaaS / Cloud)',
  },
  container: {
    label: 'Container',
    subtitle: 'Deployable unit (SPA, API, Database, Worker)',
    icon: Layers,
    color: 'bg-[#438dd5]/20 text-cyan-300 border-cyan-500/40',
    activeColor: 'bg-cyan-600 text-white border-cyan-400',
    descPlaceholder: 'e.g. Delivers the user interface to customer browsers.',
    techPlaceholder: 'e.g. React / TypeScript, PostgreSQL, Go',
  },
  component: {
    label: 'Component',
    subtitle: 'Internal module, controller, or domain service',
    icon: Cpu,
    color: 'bg-[#85bbf0]/20 text-indigo-300 border-indigo-500/40',
    activeColor: 'bg-indigo-600 text-white border-indigo-400',
    descPlaceholder: 'e.g. Handles user authentication and issues JWT tokens.',
    techPlaceholder: 'e.g. TypeScript Controller, Spring Service',
  },
  infrastructureNode: {
    label: 'Infrastructure',
    subtitle: 'Cloud resource, server, or hardware node',
    icon: Cloud,
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    activeColor: 'bg-emerald-600 text-white border-emerald-400',
    descPlaceholder: 'e.g. Amazon Web Services VPC cluster.',
    techPlaceholder: 'e.g. AWS EKS, Docker, NGINX',
  },
};

const TECH_SUGGESTIONS = [
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Go',
  'Python',
  'FastAPI',
  'Spring Boot',
  'PostgreSQL',
  'Redis',
  'MongoDB',
  'Apache Kafka',
  'RabbitMQ',
  'Docker',
  'Kubernetes',
  'AWS',
];

const TAG_SUGGESTIONS = [
  'Web Browser',
  'Microservice',
  'Database',
  'Message Queue',
  'External',
  'Existing System',
];

function toCamelCase(str: string): string {
  const cleaned = str.replace(/[^a-zA-Z0-9_\s]/g, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  let result = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
  for (let i = 1; i < parts.length; i++) {
    result += parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
  }
  if (/^[0-9]/.test(result)) {
    result = 'el_' + result;
  }
  return result;
}

export const QuickAddElementModal: React.FC<QuickAddElementModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  isAdding = false,
  initialType = 'softwareSystem',
  systems = [],
  containers = [],
  defaultParentId,
}) => {
  if (!isOpen) return null;

  return (
    <QuickAddElementModalContent
      isOpen={isOpen}
      onClose={onClose}
      onAdd={onAdd}
      isAdding={isAdding}
      initialType={initialType}
      systems={systems}
      containers={containers}
      defaultParentId={defaultParentId}
    />
  );
};

const QuickAddElementModalContent: React.FC<QuickAddElementModalProps> = ({
  onClose,
  onAdd,
  isAdding = false,
  initialType = 'softwareSystem',
  systems = [],
  containers = [],
  defaultParentId,
}) => {
  const [type, setType] = useState<PaletteElementType>(initialType);
  const [name, setName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [isIdentifierManual, setIsIdentifierManual] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [technology, setTechnology] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [location, setLocation] = useState<string>('Internal');
  const [parentId, setParentId] = useState<string>(() => {
    if (defaultParentId) return defaultParentId;
    if (initialType === 'container' && systems.length > 0) return systems[0].identifier || systems[0].id;
    if (initialType === 'component' && containers.length > 0) return containers[0].identifier || containers[0].id;
    return '';
  });
  const [createDefaultView, setCreateDefaultView] = useState<boolean>(true);

  // Auto-select parent if type changes
  useEffect(() => {
    if (type === 'container') {
      if (!parentId || !systems.some((s) => s.identifier === parentId || s.id === parentId)) {
        if (systems.length > 0) {
          setParentId(systems[0].identifier || systems[0].id);
        }
      }
    } else if (type === 'component') {
      if (!parentId || !containers.some((c) => c.identifier === parentId || c.id === parentId)) {
        if (containers.length > 0) {
          setParentId(containers[0].identifier || containers[0].id);
        }
      }
    }
  }, [type, systems, containers]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isIdentifierManual) {
      setIdentifier(toCamelCase(val));
    }
  };

  const handleIdentifierChange = (val: string) => {
    setIsIdentifierManual(true);
    setIdentifier(val.replace(/[^a-zA-Z0-9_]/g, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      type,
      name: name.trim(),
      identifier: identifier.trim() || toCamelCase(name.trim()),
      description: description.trim(),
      technology: technology.trim(),
      tags: tags.trim(),
      parentId: (type === 'container' || type === 'component') ? parentId : undefined,
      location: (type === 'person' || type === 'softwareSystem') ? location : undefined,
      createDefaultView,
    });
  };

  const currentConfig = TYPE_CONFIG[type];
  const Icon = currentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${currentConfig.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Quick Add Element
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
          {/* Element Type Selector Tabs */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Element Type
            </label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              {(Object.keys(TYPE_CONFIG) as PaletteElementType[]).map((t) => {
                const conf = TYPE_CONFIG[t];
                const TIcon = conf.icon;
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-center font-medium transition cursor-pointer ${
                      isSelected
                        ? conf.activeColor
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <TIcon className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] leading-tight truncate w-full px-0.5">
                      {conf.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parent selection (for container or component) */}
          {type === 'container' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Parent Software System <span className="text-rose-400">*</span>
              </label>
              {systems.length > 0 ? (
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
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

          {type === 'component' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Parent Container <span className="text-rose-400">*</span>
              </label>
              {containers.length > 0 ? (
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
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

          {/* Name & Identifier Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Payments Service"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                DSL Identifier
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                placeholder="e.g. paymentsService"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={currentConfig.descPlaceholder}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          {/* Technology (for Container, Component, Infrastructure) */}
          {(type === 'container' || type === 'component' || type === 'infrastructureNode') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Technology
              </label>
              <input
                type="text"
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                placeholder={currentConfig.techPlaceholder}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
              />
              {/* Quick Tech Suggestions */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {TECH_SUGGESTIONS.map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => {
                      if (!technology) {
                        setTechnology(tech);
                      } else if (!technology.includes(tech)) {
                        setTechnology(`${technology}, ${tech}`);
                      }
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition cursor-pointer border border-slate-700/60"
                  >
                    +{tech}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location for Person & System */}
          {(type === 'person' || type === 'softwareSystem') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Location
              </label>
              <div className="flex gap-2">
                {['Internal', 'External'].map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                      location === loc
                        ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Tags / Archetype
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Microservice, Database, WebBrowser"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (!tags) setTags(tag);
                    else if (!tags.includes(tag)) setTags(`${tags}, ${tag}`);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 hover:text-purple-300 hover:bg-slate-700 transition cursor-pointer border border-slate-700/60"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-generate View option */}
          {(type === 'softwareSystem' || type === 'container') && (
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createDefaultView}
                onChange={(e) => setCreateDefaultView(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-semibold">
                {type === 'softwareSystem'
                  ? 'Automatically generate Container view for this system'
                  : 'Automatically generate Component view for this container'}
              </span>
            </label>
          )}

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
              disabled={isAdding || !name.trim() || ((type === 'container' || type === 'component') && !parentId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-cyan-600/30 transition cursor-pointer"
            >
              {isAdding ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Element to DSL</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

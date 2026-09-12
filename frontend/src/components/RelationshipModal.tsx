import React, { useState } from 'react';
import { ArrowLeftRight, X, Trash2, Link2, Check } from 'lucide-react';
import type { Node } from '@xyflow/react';

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'reconnect';
  onClose: () => void;
  onSave: (data: { sourceId: string; targetId: string; description: string; technology: string }) => void;
  onDelete?: () => void;
  sourceNode?: Node | null;
  targetNode?: Node | null;
  initialDescription?: string;
  initialTechnology?: string;
  isSaving?: boolean;
}

const COMMON_DESCRIPTIONS = [
  'Uses',
  'Makes API calls to',
  'Sends requests to',
  'Reads from and writes to',
  'Publishes events to',
  'Delivers notifications to',
];

const COMMON_TECHNOLOGIES = [
  'HTTPS',
  'JSON / REST',
  'gRPC',
  'SQL',
  'WebSocket',
  'Kafka',
];

export const RelationshipModal: React.FC<Props> = (props) => {
  if (!props.isOpen) return null;
  return <RelationshipModalContent {...props} />;
};

const RelationshipModalContent: React.FC<Props> = ({
  mode,
  onClose,
  onSave,
  onDelete,
  sourceNode,
  targetNode,
  initialDescription = '',
  initialTechnology = '',
  isSaving = false,
}) => {
  const [description, setDescription] = useState<string>(initialDescription || '');
  const [technology, setTechnology] = useState<string>(initialTechnology || '');
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  const activeSourceNode = isSwapped ? targetNode : sourceNode;
  const activeTargetNode = isSwapped ? sourceNode : targetNode;

  const currentSourceId = activeSourceNode?.id || '';
  const currentTargetId = activeTargetNode?.id || '';

  const handleSwap = () => {
    setIsSwapped((prev) => !prev);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSourceId || !currentTargetId) return;
    onSave({
      sourceId: currentSourceId,
      targetId: currentTargetId,
      description: description.trim(),
      technology: technology.trim(),
    });
  };

  const getNodeName = (node?: Node | null, fallbackId: string = '') => {
    if (!node) return fallbackId;
    return (node.data as any)?.name || (node.data as any)?.identifier || node.id;
  };

  const getNodeType = (node?: Node | null) => {
    if (!node) return 'Element';
    const type = (node.data as any)?.type || 'element';
    if (type === 'person') return 'Person';
    if (type === 'softwareSystem') return 'System';
    if (type === 'container') return 'Container';
    if (type === 'component') return 'Component';
    return type;
  };

  const getTitle = () => {
    if (mode === 'create') return 'Create Relationship';
    if (mode === 'reconnect') return 'Reconnect Relationship';
    return 'Edit Relationship';
  };

  const getSubtitle = () => {
    if (mode === 'create') {
      return 'Connect elements to define interactions in the architecture model and DSL.';
    }
    if (mode === 'reconnect') {
      return 'Update the connection endpoints for this relationship in the model and DSL.';
    }
    return 'Update description and technology or remove this relationship from the model.';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{getTitle()}</h3>
              <p className="text-xs text-slate-400">{getSubtitle()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Connection Visual Overview */}
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/80 flex items-center justify-between gap-2">
            {/* Source */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Source ({getNodeType(activeSourceNode)})
              </div>
              <div
                className="text-sm font-semibold text-cyan-300 truncate"
                title={getNodeName(activeSourceNode, currentSourceId)}
              >
                {getNodeName(activeSourceNode, currentSourceId)}
              </div>
            </div>

            {/* Swap direction button */}
            <button
              type="button"
              onClick={handleSwap}
              disabled={isSaving}
              className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition group cursor-pointer"
              title="Reverse direction"
            >
              <ArrowLeftRight className="w-4 h-4 transition-transform group-hover:rotate-180 duration-300" />
            </button>

            {/* Target */}
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Target ({getNodeType(activeTargetNode)})
              </div>
              <div
                className="text-sm font-semibold text-emerald-300 truncate"
                title={getNodeName(activeTargetNode, currentTargetId)}
              >
                {getNodeName(activeTargetNode, currentTargetId)}
              </div>
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Description / Action
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Uses, Sends requests to, Reads data from"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              autoFocus
              disabled={isSaving}
            />
            {/* Quick description chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_DESCRIPTIONS.map((desc) => (
                <button
                  type="button"
                  key={desc}
                  onClick={() => setDescription(desc)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    description === desc
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/60 font-medium'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/60'
                  }`}
                >
                  {desc}
                </button>
              ))}
            </div>
          </div>

          {/* Technology Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Technology (Optional)
            </label>
            <input
              type="text"
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              placeholder="e.g. HTTPS, JSON/REST, gRPC, SQL"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              disabled={isSaving}
            />
            {/* Quick technology chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_TECHNOLOGIES.map((tech) => (
                <button
                  type="button"
                  key={tech}
                  onClick={() => setTechnology(tech)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    technology === tech
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/60 font-medium'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/60'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-800/80">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl border border-rose-500/30 transition cursor-pointer"
                title="Delete this relationship"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !currentSourceId || !currentTargetId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{mode === 'create' ? 'Create Relationship' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default RelationshipModal;

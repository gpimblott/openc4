import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { User, Server, Box, Layers, Database as DbIcon, Globe } from 'lucide-react';

export interface C4NodeData {
  id: string;
  name: string;
  description: string;
  type: string;
  technology?: string;
  tags: string[];
  backgroundColor?: string;
  color?: string;
  shape?: string;
}

const C4Node = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as C4NodeData;
  const isPerson = nodeData.type === 'person' || nodeData.shape === 'Person';
  const isDatabase = nodeData.shape === 'Cylinder' || (nodeData.tags && nodeData.tags.includes('Database'));
  const isWeb = nodeData.tags && nodeData.tags.includes('WebBrowser');

  const isComponent = nodeData.type === 'component';
  const rawBg = nodeData.backgroundColor;
  const isValidBg = rawBg && rawBg !== 'color' && (rawBg.startsWith('#') || rawBg.startsWith('rgb') || rawBg.startsWith('hsl'));
  const bg = isValidBg ? rawBg : (isComponent ? '#85bbf0' : '#1168bd');
  const fg = nodeData.color || (isComponent ? '#000000' : '#ffffff');

  const renderIcon = () => {
    if (isPerson) return <User className="w-4 h-4 opacity-80" />;
    if (isDatabase) return <DbIcon className="w-4 h-4 opacity-80" />;
    if (isWeb) return <Globe className="w-4 h-4 opacity-80" />;
    if (nodeData.type === 'container') return <Box className="w-4 h-4 opacity-80" />;
    if (nodeData.type === 'component') return <Layers className="w-4 h-4 opacity-80" />;
    return <Server className="w-4 h-4 opacity-80" />;
  };

  const getBadgeLabel = () => {
    if (nodeData.type === 'person') return 'Person';
    if (nodeData.type === 'softwareSystem') return 'Software System';
    if (nodeData.type === 'container') return nodeData.technology ? `Container: ${nodeData.technology}` : 'Container';
    if (nodeData.type === 'component') return nodeData.technology ? `Component: ${nodeData.technology}` : 'Component';
    return 'Element';
  };

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] p-4 text-center transition-all duration-150 select-none shadow-lg ${
        isPerson
          ? 'rounded-3xl border-2'
          : isDatabase
          ? 'rounded-t-3xl rounded-b-xl border-2'
          : 'rounded-xl border-2'
      } ${
        selected
          ? 'border-cyan-400 ring-4 ring-cyan-400/30 scale-105'
          : 'border-white/20 hover:border-white/50'
      }`}
      style={{
        backgroundColor: bg,
        color: fg,
      }}
    >
      {/* Top handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />

      {/* Right handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />

      {/* Bottom handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />

      {/* Left handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-400 !border-2 !border-slate-900 transition-colors"
      />

      <div className="flex items-center justify-center gap-1.5 mb-1.5 text-xs font-semibold tracking-wider uppercase opacity-85">
        {renderIcon()}
        <span>[{getBadgeLabel()}]</span>
      </div>

      <div className="font-bold text-base leading-snug tracking-tight mb-1">
        {nodeData.name}
      </div>

      {nodeData.description && (
        <div className="text-xs leading-relaxed opacity-85 italic mt-1 line-clamp-3">
          {nodeData.description}
        </div>
      )}
    </div>
  );
};

export default memo(C4Node);

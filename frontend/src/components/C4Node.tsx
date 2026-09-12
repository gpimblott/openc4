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
  stroke?: string;
  strokeWidth?: number;
}

const C4Node = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as C4NodeData;
  const shapeLower = (nodeData.shape || '').toLowerCase();
  const isPerson = nodeData.type === 'person' || shapeLower === 'person';
  const isDatabase =
    shapeLower === 'cylinder' || (nodeData.tags && nodeData.tags.some((t) => t.toLowerCase() === 'database'));
  const isWeb =
    shapeLower === 'webbrowser' || (nodeData.tags && nodeData.tags.some((t) => t.toLowerCase() === 'webbrowser'));
  const isBox = shapeLower === 'box';

  const isComponent = nodeData.type === 'component' || shapeLower === 'component';
  const rawBg = nodeData.backgroundColor;
  const isValidBg =
    rawBg &&
    rawBg !== 'color' &&
    (rawBg.startsWith('#') || rawBg.startsWith('rgb') || rawBg.startsWith('hsl'));
  const bg = isValidBg ? rawBg : isComponent ? '#85bbf0' : isPerson ? '#08427b' : '#1168bd';
  const fg = nodeData.color || (isComponent ? '#000000' : '#ffffff');

  const strokeColor = selected ? '#22d3ee' : nodeData.stroke || 'rgba(255, 255, 255, 0.25)';
  const strokeWidth =
    nodeData.strokeWidth !== undefined && nodeData.strokeWidth !== null ? nodeData.strokeWidth : 2;

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
    if (nodeData.type === 'container')
      return nodeData.technology ? `Container: ${nodeData.technology}` : 'Container';
    if (nodeData.type === 'component')
      return nodeData.technology ? `Component: ${nodeData.technology}` : 'Component';
    return 'Element';
  };

  const getShapeRadiusClass = () => {
    if (isDatabase) return '';
    if (isBox) return 'rounded-none';
    if (isPerson) return 'rounded-2xl mt-4 pt-5';
    return 'rounded-xl';
  };

  const getContainerStyle = (): React.CSSProperties => {
    if (isDatabase) {
      return {
        backgroundColor: 'transparent',
        color: fg,
        filter: selected
          ? 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.8))'
          : 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))',
      };
    }
    return {
      backgroundColor: bg,
      color: fg,
      borderColor: strokeColor,
      borderWidth: `${strokeWidth}px`,
      borderStyle: 'solid',
    };
  };

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] ${
        isDatabase ? 'pt-8 pb-5 px-5' : 'p-4'
      } text-center transition-all duration-150 select-none ${getShapeRadiusClass()} ${
        selected
          ? isDatabase
            ? 'scale-105'
            : 'ring-4 ring-cyan-400/40 shadow-cyan-500/20 shadow-xl scale-105'
          : isDatabase
          ? ''
          : 'shadow-lg hover:brightness-110'
      }`}
      style={getContainerStyle()}
    >
      {/* Visual Shape: Seamless 3D Cylinder SVG */}
      {isDatabase && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Cylinder Body Fill */}
          <path
            d="M 1 14 V 86 A 49 12 0 0 0 99 86 V 14 A 49 12 0 0 1 1 14 Z"
            fill={bg}
          />
          {/* Cylinder Outer Contour: Left side + Bottom Arc + Right side */}
          <path
            d="M 1 14 V 86 A 49 12 0 0 0 99 86 V 14"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Cylinder Top Ellipse */}
          <ellipse
            cx="50"
            cy="14"
            rx="49"
            ry="12"
            fill={bg}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          {/* 3D Top Cap Highlight Accent */}
          <ellipse
            cx="50"
            cy="14"
            rx="47"
            ry="10"
            fill="rgba(255, 255, 255, 0.1)"
          />
        </svg>
      )}

      {/* Visual Shape: Person Circular Head on Top */}
      {isPerson && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full shadow-md flex items-center justify-center z-10 transition-transform hover:scale-110"
          style={{
            backgroundColor: bg,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
            borderStyle: 'solid',
            color: fg,
          }}
        >
          <User className="w-6 h-6 opacity-90" />
        </div>
      )}

      {/* Visual Shape: Web Browser Chrome */}
      {isWeb && (
        <div className="flex items-center gap-1 pb-2 mb-2 border-b border-white/20">
          <div className="w-2 h-2 rounded-full bg-red-400/80" />
          <div className="w-2 h-2 rounded-full bg-yellow-400/80" />
          <div className="w-2 h-2 rounded-full bg-green-400/80" />
          <div className="ml-1.5 flex-1 h-3 rounded bg-white/15 text-[8px] flex items-center px-1.5 opacity-70 truncate font-mono">
            browser://view
          </div>
        </div>
      )}

      {/* Top handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={isPerson ? { top: '-28px' } : undefined}
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={isPerson ? { top: '-28px' } : undefined}
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />

      {/* Right handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />

      {/* Bottom handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />

      {/* Left handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-3.5 !h-3.5 !bg-slate-300 hover:!bg-cyan-400 hover:scale-125 !border-2 !border-slate-900 transition-all cursor-crosshair z-20"
      />

      <div className="relative z-10">
        <div className="flex items-center justify-center gap-1.5 mb-1.5 text-xs font-semibold tracking-wider uppercase opacity-85">
          {!isPerson && renderIcon()}
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
    </div>
  );
};

export default memo(C4Node);

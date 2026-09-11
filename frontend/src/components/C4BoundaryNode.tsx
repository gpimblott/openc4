import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Box, Server, Boxes } from 'lucide-react';

export interface C4BoundaryNodeData {
  id: string;
  name: string;
  type: string; // 'container' | 'softwareSystem' | 'group'
  technology?: string;
  description?: string;
  childIds: string[];
  parentBoundaryId?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
}

const C4BoundaryNode = ({ data }: NodeProps) => {
  const boundary = data as unknown as C4BoundaryNodeData;
  const isContainer = boundary.type === 'container';
  const isGroup = boundary.type === 'group';
  const customBorderWidth = boundary.strokeWidth ? `${boundary.strokeWidth}px` : undefined;
  const customBorderColor = boundary.stroke || undefined;

  return (
    <div
      className={`w-full h-full rounded-2xl border-dashed pointer-events-none transition-colors duration-150 shadow-sm relative ${
        isGroup
          ? 'border-emerald-400/50 bg-emerald-950/15'
          : isContainer
          ? 'border-sky-400/60 bg-sky-950/20'
          : 'border-indigo-400/40 bg-slate-950/40'
      } ${!customBorderWidth ? 'border-2' : ''}`}
      style={{
        borderWidth: customBorderWidth,
        borderColor: customBorderColor,
      }}
    >
      {/* Header Badge */}
      <div
        className={`absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between border-b rounded-t-2xl ${
          isGroup
            ? 'border-emerald-400/25 bg-emerald-900/30'
            : isContainer
            ? 'border-sky-400/25 bg-sky-900/40'
            : 'border-indigo-400/20 bg-indigo-950/50'
        }`}
      >
        <div className="flex items-center gap-2">
          {isGroup ? (
            <Boxes className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : isContainer ? (
            <Box className="w-4 h-4 text-sky-400 shrink-0" />
          ) : (
            <Server className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <span
            className={`text-xs font-bold tracking-wider uppercase ${
              isGroup
                ? 'text-emerald-300'
                : isContainer
                ? 'text-sky-300'
                : 'text-indigo-300'
            }`}
          >
            {isGroup
              ? '[Group]'
              : isContainer
              ? boundary.technology
                ? `[Container: ${boundary.technology}]`
                : '[Container]'
              : '[Software System]'}
          </span>
          <span className="text-sm font-extrabold text-white ml-1">
            {boundary.name}
          </span>
        </div>
        {boundary.description && (
          <span
            className={`text-xs italic truncate max-w-[45%] text-right ${
              isGroup
                ? 'text-emerald-200/70'
                : isContainer
                ? 'text-sky-200/70'
                : 'text-indigo-200/70'
            }`}
          >
            {boundary.description}
          </span>
        )}
      </div>
    </div>
  );
};

export default memo(C4BoundaryNode);

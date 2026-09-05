import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Box, Server } from 'lucide-react';

export interface C4BoundaryNodeData {
  id: string;
  name: string;
  type: string; // 'container' | 'softwareSystem'
  technology?: string;
  description?: string;
  childIds: string[];
  parentBoundaryId?: string | null;
}

const C4BoundaryNode = ({ data }: NodeProps) => {
  const boundary = data as unknown as C4BoundaryNodeData;
  const isContainer = boundary.type === 'container';

  return (
    <div
      className={`w-full h-full rounded-2xl border-2 border-dashed pointer-events-none transition-colors duration-150 shadow-sm relative ${
        isContainer
          ? 'border-sky-400/60 bg-sky-950/20'
          : 'border-indigo-400/40 bg-slate-950/40'
      }`}
    >
      {/* Header Badge */}
      <div
        className={`absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between border-b rounded-t-2xl ${
          isContainer
            ? 'border-sky-400/25 bg-sky-900/40'
            : 'border-indigo-400/20 bg-indigo-950/50'
        }`}
      >
        <div className="flex items-center gap-2">
          {isContainer ? (
            <Box className="w-4 h-4 text-sky-400 shrink-0" />
          ) : (
            <Server className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <span
            className={`text-xs font-bold tracking-wider uppercase ${
              isContainer ? 'text-sky-300' : 'text-indigo-300'
            }`}
          >
            {isContainer
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
              isContainer ? 'text-sky-200/70' : 'text-indigo-200/70'
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

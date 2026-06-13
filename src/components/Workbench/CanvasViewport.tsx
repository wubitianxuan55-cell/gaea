import React, { useRef, useMemo } from 'react';
import { useCanvasPanZoom } from './useCanvasPanZoom';
import { computeLayout, computeEdges } from './canvasLayout';
import { CanvasCard as CanvasCardComponent } from './CanvasCard';
import { CanvasCard, CanvasEdge, PositionedCard } from './types';
import { RefreshCw, Trash2 } from 'lucide-react';

interface CanvasViewportProps {
  cards: CanvasCard[];
  edges: CanvasEdge[];
  onRetry?: (cardId: string) => void;
  onClear?: () => void;
}

function EdgeLine({ edge, cards }: { edge: CanvasEdge; cards: PositionedCard[] }) {
  const src = cards.find(c => c.id === edge.sourceId);
  const tgt = cards.find(c => c.id === edge.targetId);
  if (!src || !tgt) return null;

  const x1 = src.x + src.width / 2;
  const y1 = src.y + src.height;
  const x2 = tgt.x + tgt.width / 2;
  const y2 = tgt.y;
  const midY = (y1 + y2) / 2;

  const color = edge.color || (edge.dashed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)');
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={edge.dashed ? '5,5' : undefined}
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <polygon
        points={`${x2 - 4},${y2 - 8} ${x2},${y2} ${x2 + 4},${y2 - 8}`}
        fill={color}
      />
    </g>
  );
}

export function CanvasViewport({ cards, edges, onRetry, onClear }: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, viewportStyle, resetView } = useCanvasPanZoom(containerRef);

  const positioned = useMemo(() => {
    const viewportWidth = containerRef.current?.clientWidth || 1200;
    return computeLayout(cards, viewportWidth / scale);
  }, [cards, scale]);

  // Filter edges to only those whose endpoints exist
  const visibleEdges = useMemo(() => {
    const cardIds = new Set(positioned.map(c => c.id));
    return computeEdges(cards, edges).filter(e => cardIds.has(e.sourceId) && cardIds.has(e.targetId));
  }, [cards, edges, positioned]);

  const svgWidth = 8000;
  const svgHeight = 8000;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: 'grab' }}
    >
      {/* Dot grid background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
        <defs>
          <pattern id="canvas-dots" x="0" y="0" width={40 * scale} height={40 * scale} patternUnits="userSpaceOnUse">
            <circle cx={20 * scale} cy={20 * scale} r={1.5 * scale} fill="rgba(255,255,255,0.4)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#canvas-dots)" />
      </svg>

      {/* Controls */}
      <div data-no-pan className="absolute bottom-24 right-6 z-40 flex items-center gap-1 bg-black/60 backdrop-blur-xl rounded-xl border border-white/[0.08] p-1">
        <button
          onClick={() => containerRef.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true }))}
          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
        >−</button>
        <span className="text-xs text-white/50 min-w-[40px] text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => containerRef.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true }))}
          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
        >+</button>
        <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
        <button onClick={resetView} className="px-2 h-8 text-[10px] text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
          Reset
        </button>
        {onClear && cards.length > 0 && (
          <>
            <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
            <button
              onClick={onClear}
              title="Clear canvas"
              className="w-8 h-8 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
            ><Trash2 size={14} /></button>
          </>
        )}
      </div>

      {/* Transformed canvas — text "Drag to pan, scroll to zoom, Ctrl+Scroll to scale" */}
      <div
        className="absolute"
        style={{
          ...viewportStyle,
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
          pointerEvents: 'none',
        }}
      >
        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
          style={{ overflow: 'visible' }}
        >
          {visibleEdges.map(edge => (
            <EdgeLine key={edge.id} edge={edge} cards={positioned} />
          ))}
        </svg>

        {/* Cards */}
        {positioned.map(card => (
          <div key={card.id} data-canvas-card style={{ pointerEvents: 'auto' }}>
            <CanvasCardComponent
              card={card}
              onRetry={card.status === 'error' || card.type === 'tool_call' ? onRetry : undefined}
            />
          </div>
        ))}

        {/* Empty state */}
        {cards.length === 0 && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-5xl mb-4 opacity-20">∞</div>
            <p className="text-white/30 text-sm">Tell me what to do — I'll work here</p>
            <p className="text-white/15 text-xs mt-2">Drag to pan · Scroll to zoom · Click empty space to drag</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Auto-layout algorithm for infinite canvas cards
import { CanvasCard, CanvasEdge, PositionedCard } from './types';

const CARD_GAP = 24;
const GROUP_GAP = 48;
const MAX_CARD_WIDTH = 700;
const TOOL_CARD_WIDTH = 320;
const SOLO_TOOL_WIDTH = 500;
const REASONING_WIDTH_RATIO = 0.8;
const COMPACT_WIDTH = 280;
const PARALLEL_THRESHOLD_MS = 800;
const MIN_HEIGHT = 80;

function estimateHeight(text: string, width: number): number {
  const charsPerLine = Math.max(20, Math.floor(width / 7));
  const lines = Math.ceil((text || '').length / charsPerLine);
  return Math.max(MIN_HEIGHT, lines * 20 + 56);
}

export function computeLayout(cards: CanvasCard[], viewportWidth: number): PositionedCard[] {
  if (cards.length === 0) return [];

  // Group by groupId, preserving order by min timestamp in group
  const groups = new Map<string, CanvasCard[]>();
  for (const card of cards) {
    const list = groups.get(card.groupId) || [];
    list.push(card);
    groups.set(card.groupId, list);
  }

  const groupEntries = Array.from(groups.entries()).sort((a, b) => {
    const aMin = Math.min(...a[1].map(c => c.timestamp));
    const bMin = Math.min(...b[1].map(c => c.timestamp));
    return aMin - bMin;
  });

  const effectiveWidth = Math.min(viewportWidth, MAX_CARD_WIDTH + 80);
  let currentY = 40;
  const result: PositionedCard[] = [];

  for (const [, groupCards] of groupEntries) {
    // Sort within group by timestamp
    const sorted = [...groupCards].sort((a, b) => a.timestamp - b.timestamp);

    // Identify parallel tool clusters
    let i = 0;
    while (i < sorted.length) {
      const card = sorted[i];

      // Check for parallel tool_call cluster
      if (card.type === 'tool_call') {
        const cluster: CanvasCard[] = [card];
        let j = i + 1;
        while (j < sorted.length && sorted[j].type === 'tool_call' &&
          (sorted[j].timestamp - sorted[j - 1].timestamp) < PARALLEL_THRESHOLD_MS) {
          cluster.push(sorted[j]);
          j++;
        }

        if (cluster.length > 1) {
          // Parallel layout
          const totalWidth = cluster.length * TOOL_CARD_WIDTH + (cluster.length - 1) * 12;
          const startX = Math.max(20, (effectiveWidth - totalWidth) / 2);
          let maxH = 0;
          for (let k = 0; k < cluster.length; k++) {
            const h = estimateHeight(cluster[k].text, TOOL_CARD_WIDTH);
            maxH = Math.max(maxH, h);
          }
          for (let k = 0; k < cluster.length; k++) {
            const x = startX + k * (TOOL_CARD_WIDTH + 12);
            const h = estimateHeight(cluster[k].text, TOOL_CARD_WIDTH);
            result.push({ ...cluster[k], x, y: currentY, width: TOOL_CARD_WIDTH, height: h });
          }
          currentY += maxH + CARD_GAP;
          i = j;
          continue;
        }
      }

      // Single card layout
      let width: number;
      let x: number;
      const centerX = Math.max(20, (effectiveWidth - MAX_CARD_WIDTH) / 2);

      switch (card.type) {
        case 'user_request':
        case 'stage_header':
        case 'final_output':
          width = MAX_CARD_WIDTH;
          x = centerX;
          break;
        case 'reasoning_text':
          width = Math.floor(effectiveWidth * REASONING_WIDTH_RATIO);
          x = centerX + 40;
          break;
        case 'tool_call':
          width = SOLO_TOOL_WIDTH;
          x = centerX;
          break;
        case 'source_citation':
        case 'artifact':
          width = COMPACT_WIDTH;
          x = centerX;
          break;
        case 'error':
          width = SOLO_TOOL_WIDTH;
          x = centerX;
          break;
        default:
          width = SOLO_TOOL_WIDTH;
          x = centerX;
      }

      const h = estimateHeight(card.text, width);
      result.push({ ...card, x, y: currentY, width, height: h });
      currentY += h + CARD_GAP;
      i++;
    }

    currentY += GROUP_GAP;
  }

  return result;
}

/** Derive edges from card ordering + explicit parentId references */
export function computeEdges(_cards: CanvasCard[], existingEdges: CanvasEdge[]): CanvasEdge[] {
  // Group cards by groupId
  const groups = new Map<string, CanvasCard[]>();
  for (const c of _cards) {
    const list = groups.get(c.groupId) || [];
    list.push(c);
    groups.set(c.groupId, list);
  }

  const edges: CanvasEdge[] = [];

  for (const [groupId, groupCards] of groups) {
    // Sort by timestamp
    const sorted = [...groupCards].sort((a, b) => a.timestamp - b.timestamp);

    // Create a flag to mark which connections are from explicit parentId
    const connected = new Set<string>();
    for (const card of sorted) {
      if (card.parentId && sorted.some(c => c.id === card.parentId)) {
        edges.push({
          id: `edge_${card.parentId}_${card.id}`,
          sourceId: card.parentId,
          targetId: card.id,
          dashed: true,
          color: 'rgba(139,92,246,0.35)',
        });
        connected.add(card.id);
      }
    }

    // Chain remaining cards in order
    for (let i = 1; i < sorted.length; i++) {
      if (!connected.has(sorted[i].id)) {
        edges.push({
          id: `edge_${sorted[i - 1].id}_${sorted[i].id}`,
          sourceId: sorted[i - 1].id,
          targetId: sorted[i].id,
        });
      }
    }
  }

  // Merge with externally created edges, deduplicating by source+target
  const edgeKeys = new Set<string>();
  for (const e of edges) edgeKeys.add(`${e.sourceId}_${e.targetId}`);
  for (const e of existingEdges) {
    const key = `${e.sourceId}_${e.targetId}`;
    if (!edgeKeys.has(key)) {
      edges.push(e);
      edgeKeys.add(key);
    }
  }

  return edges;
}

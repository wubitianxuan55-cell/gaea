// Holographic output abstraction
// Defines how the AI core outputs spatial holographic content.
//
// When a holographic-capable device is connected (holographic: true in capabilities),
// the AI can respond with spatial output in addition to text/audio.

export interface HolographicSpatialPosition {
  /** X coordinate in 3D space (meters from origin) */
  x: number;
  /** Y coordinate in 3D space (meters from origin) */
  y: number;
  /** Z coordinate in 3D space (meters from origin) */
  z: number;
}

export interface HolographicAnimation {
  /** Animation type */
  type: 'fade_in' | 'fade_out' | 'float' | 'orbit' | 'pulse' | 'none';
  /** Duration in milliseconds */
  durationMs: number;
  /** Easing function */
  easing: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out';
}

export interface HolographicOutput {
  /** Output type discriminator — distinguishes holographic from text/audio responses */
  contentType: 'holographic';
  /** What to render */
  content: HolographicElement[];
  /** When to render (Unix timestamp ms, or "immediate") */
  timing: 'immediate' | number;
  /** How long this output persists on screen (ms, 0 = until dismissed) */
  ttl: number;
}

export type HolographicElement =
  | HolographicText
  | HolographicMesh
  | HolographicPointCloud
  | HolographicUI;

export interface HolographicText {
  type: 'text';
  text: string;
  position: HolographicSpatialPosition;
  /** Font size in holographic units */
  fontSize: number;
  /** RGBA color */
  color: [number, number, number, number];
  animation: HolographicAnimation;
}

export interface HolographicMesh {
  type: 'mesh';
  /** GLTF/GLB model URL or inline data */
  modelUri: string;
  position: HolographicSpatialPosition;
  /** Rotation in degrees */
  rotation: [number, number, number];
  /** Scale factor */
  scale: [number, number, number];
  animation: HolographicAnimation;
}

export interface HolographicPointCloud {
  type: 'point_cloud';
  /** Array of [x, y, z] points */
  points: [number, number, number][];
  /** Point color */
  color: [number, number, number, number];
  /** Point size */
  pointSize: number;
  position: HolographicSpatialPosition;
  animation: HolographicAnimation;
}

export interface HolographicUI {
  type: 'ui_panel';
  /** Markdown content to render on the holographic UI panel */
  markdown: string;
  position: HolographicSpatialPosition;
  /** Panel dimensions */
  size: { width: number; height: number };
  /** Interactive buttons/actions */
  actions?: HolographicAction[];
  animation: HolographicAnimation;
}

export interface HolographicAction {
  id: string;
  label: string;
  /** Action to emit back to the AI core when triggered */
  event: string;
}

/**
 * Build a minimal holographic response from a text message.
 * This is the fallback for when no specific holographic output is configured.
 */
export function textToHolographicOutput(text: string): HolographicOutput {
  return {
    contentType: 'holographic',
    content: [
      {
        type: 'text',
        text,
        position: { x: 0, y: 0.3, z: -1 },
        fontSize: 24,
        color: [1, 0.9, 0.5, 0.9], // warm gold
        animation: { type: 'fade_in', durationMs: 400, easing: 'ease_out' },
      },
    ],
    timing: 'immediate',
    ttl: 0, // persist until dismissed
  };
}

/**
 * Check if the current device context supports holographic output.
 */
export function canOutputHolographic(sensoryContext?: {
  holographic?: boolean;
}): boolean {
  return sensoryContext?.holographic === true;
}

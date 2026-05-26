declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
}
declare module '@picovoice/porcupine-web' {
  export class PorcupineWorker {}
  export class BuiltinKeyword {}
  export type PorcupineWorkerOptions = any;
}
declare module '@react-three/postprocessing' {
  export const EffectComposer: any;
  export const Bloom: any;
  export const DepthOfField: any;
}

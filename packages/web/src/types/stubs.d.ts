declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
}
declare module '@picovoice/porcupine-web' {
  export class PorcupineWorker {}
  export class BuiltinKeyword {}
  export type PorcupineWorkerOptions = any;
}
declare module '@mediapipe/tasks-vision' {
  export class FaceDetector {}
  export class HandLandmarker {}
  export class FilesetResolver {}
}

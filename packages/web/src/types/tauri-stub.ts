export function invoke<T = any>(_cmd: string, _args?: Record<string, any>): Promise<T> {
  return Promise.reject(new Error('Tauri API not available in browser'));
}

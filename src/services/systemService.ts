/**
 * System Service Bridge
 * Abstracts communication between the React frontend and the Desktop shell (Tauri/Electron).
 */

export interface CommandResponse {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

class SystemService {
  private isTauri: boolean;
  private isElectron: boolean;

  constructor() {
    this.isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_IPC__ || !!(window as any).__TAURI__);
    this.isElectron = typeof window !== 'undefined' && (!!(window as any).lumiElectron || navigator.userAgent.toLowerCase().includes('electron'));
  }

  /**
   * Execute a system command
   */
  async runCommand(command: string): Promise<CommandResponse> {
    if (this.isTauri) {
      try {
        // Tauri 'run_command' would be a custom command defined in src-tauri/src/main.rs
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('run_command', { command });
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    }

    if (this.isElectron && (window as any).lumiElectron) {
      return await (window as any).lumiElectron.runCommand(command);
    }

    // Web simulation
    console.log(`[SIMULATION] Executing command: ${command}`);
    return { 
      success: true, 
      output: `Web simulated response for: ${command}\nKernel status: OK`,
      exitCode: 0
    };
  }

  /**
   * Set window click-through (for transparent wallpaper mode)
   */
  async setClickThrough(enabled: boolean): Promise<void> {
    if (this.isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_ignore_cursor_events', { ignore: enabled });
      } catch (err) {
        console.error("Failed to set click-through:", err);
      }
    }
    // Electron click-through would use a different IPC call
  }

  /**
   * Get system info (CPU, RAM, etc)
   */
  async getSystemStats(): Promise<any> {
    if (this.isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('get_system_info');
      } catch (err) {
        console.error("Failed to get system stats:", err);
        return { cpu: 0, ram: 'N/A' };
      }
    }
    if (this.isElectron) {
      return { cpu: 12, ram: '8GB/16GB' }; // Simplified
    }
    return { cpu: 0, ram: 'N/A' };
  }
}

export const systemService = new SystemService();

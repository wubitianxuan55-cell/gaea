import { useState, useEffect, useCallback } from 'react';

export type Platform = 'web' | 'electron' | 'tauri' | 'ios' | 'android';

export interface SensorData {
  latitude?: number;
  longitude?: number;
  speed?: number;
  acceleration?: { x: number; y: number; z: number };
}

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>(() => {
    if (typeof window !== 'undefined') {
      if ((window as any).lumiElectron || navigator.userAgent.toLowerCase().includes('electron')) {
        return 'electron';
      }
      if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__ || (window as any).__TAURI__) {
        return 'tauri';
      }
    }
    return 'web';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [sensors, setSensors] = useState<SensorData>({});

  useEffect(() => {
    // Check for Electron
    if (window && (window as any).lumiElectron) {
      setPlatform('electron');
      return;
    }

    // Check for Tauri
    if (window && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__ || (window as any).__TAURI__)) {
      setPlatform('tauri');
      return;
    }

    // Check for Capacitor/Cordova (Mobile)
    const win = window as any;
    const isMobile = !!(win.Capacitor && win.Capacitor.platform !== 'web');
    
    if (isMobile) {
      setPlatform(win.Capacitor.platform as Platform);
    } else {
      setPlatform('web');
    }
  }, []);

  const simulateLocalFileAccess = useCallback(async () => {
    if (platform === 'electron' || platform === 'tauri') {
      // Real IPC would go here
      return { success: true, path: '/usr/local/lumi/vault/mem_0x1.bin', size: '2.4GB' };
    }
    // Web simulation
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true, path: 'virtual://vault/simulated_mem.bin', size: '128MB' }), 1000);
    });
  }, [platform]);

  const startSensorSync = useCallback(() => {
    if (platform === 'web' && !navigator.geolocation) return;
    
    setIsSyncing(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSensors(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed || 0
        }));
      },
      (err) => console.error("Sensor Sync Error:", err),
      { enableHighAccuracy: true }
    );

    // Mock Accelerometer if not available
    const accInterval = setInterval(() => {
      setSensors(prev => ({
        ...prev,
        acceleration: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: 9.8 + (Math.random() - 0.5)
        }
      }));
    }, 1000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(accInterval);
      setIsSyncing(false);
    };
  }, [platform]);

  return {
    platform,
    isElectron: platform === 'electron',
    isTauri: platform === 'tauri',
    isDesktop: platform === 'electron' || platform === 'tauri',
    isMobile: platform === 'ios' || platform === 'android',
    isWeb: platform === 'web',
    electronAPI: (window as any).lumiElectron || null,
    simulateLocalFileAccess,
    startSensorSync,
    sensors,
    isSyncing
  };
}

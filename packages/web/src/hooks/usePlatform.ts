import { useState, useEffect, useCallback } from 'react';

export type Platform = 'web' | 'ios' | 'android';

export interface SensorData {
  latitude?: number;
  longitude?: number;
  speed?: number;
  acceleration?: { x: number; y: number; z: number };
}

export function usePlatform() {
  const [platform] = useState<Platform>('web');
  const [isSyncing, setIsSyncing] = useState(false);
  const [sensors, setSensors] = useState<SensorData>({});

  const startSensorSync = useCallback(() => {
    setIsSyncing(true);
    const cleanupFns: (() => void)[] = [];

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setSensors(prev => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || 0,
          }));
        },
        (err) => console.error('[Sensors] GPS error:', err.message),
        { enableHighAccuracy: true },
      );
      cleanupFns.push(() => navigator.geolocation.clearWatch(watchId));
    }

    if ('DeviceMotionEvent' in window) {
      const handleMotion = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity;
        if (acc) {
          setSensors(prev => ({
            ...prev,
            acceleration: {
              x: acc.x ?? 0,
              y: acc.y ?? 0,
              z: acc.z ?? 9.8,
            },
          }));
        }
      };
      window.addEventListener('devicemotion', handleMotion);
      cleanupFns.push(() => window.removeEventListener('devicemotion', handleMotion));
    }

    return () => {
      cleanupFns.forEach(fn => fn());
      setIsSyncing(false);
    };
  }, []);

  return {
    platform,
    isWeb: true as const,
    startSensorSync,
    sensors,
    isSyncing,
  };
}

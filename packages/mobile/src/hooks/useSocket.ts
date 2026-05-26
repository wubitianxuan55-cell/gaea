import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from '@/services/apiBridge';
import { getStoredToken } from '@/services/authService';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const url = getSocketOrigin();
    const token = getStoredToken();
    const s = io(url, {
      withCredentials: true,
      auth: { token },
    });

    s.on('connect', () => {
      s.emit('device:register', {
        name: navigator.platform || 'Unknown Device',
        type: 'mobile',
        capabilities: {
          audio: true,
          video: true,
          spatial: true,
          haptic: true,
          holographic: false,
        },
        osInfo: navigator.platform || '',
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return socket;
}

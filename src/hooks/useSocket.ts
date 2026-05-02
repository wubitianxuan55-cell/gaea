import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(window.location.origin);
    
    s.on('connect', () => {
      console.log('[Socket] Connected');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return socket;
}

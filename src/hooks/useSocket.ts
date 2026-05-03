import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    const origin = isTauri ? 'http://127.0.0.1:3000' : window.location.origin;
    const s = io(origin);
    
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

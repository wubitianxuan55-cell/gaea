import { Socket, Server } from "socket.io";
import { deviceRegistry } from "../devices";
import { registerUserSocket, unregisterUserSocket } from "../memory";

function socketGuard(fn: (...args: any[]) => void | Promise<void>) {
  return (...args: any[]) => {
    try {
      const ret = fn(...args);
      if (ret && typeof (ret as any).catch === 'function') {
        (ret as any).catch((e: any) => console.error('[Device] Handler error:', e.message || String(e)));
      }
    } catch (e: any) {
      console.error('[Device] Handler error:', e.message || String(e));
    }
  };
}

export function registerDeviceHandlers(socket: Socket, getUserId: (s: Socket) => string, io: Server) {
  socket.on("device:register", socketGuard((data: {
    name?: string;
    type?: string;
    capabilities?: Record<string, boolean>;
    osInfo?: string;
  }) => {
    const uid = getUserId(socket);
    deviceRegistry.register(uid, socket.id, {
      name: data.name,
      type: data.type as any,
      capabilities: data.capabilities as any,
      osInfo: data.osInfo,
      ipAddress: socket.handshake.address,
    });
    registerUserSocket(uid, socket.id);
  }));

  socket.on("disconnect", socketGuard(() => {
    const uid = getUserId(socket);
    deviceRegistry.disconnect(socket.id);
    unregisterUserSocket(socket.id);
  }));
}

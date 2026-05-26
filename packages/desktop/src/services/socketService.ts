import { io, Socket } from "socket.io-client";
import { getSocketOrigin } from "./apiBridge";

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(getSocketOrigin(), { withCredentials: true });
      
      this.socket.on("connect", () => {
        console.log("[Socket] Connected to server");
      });

      this.socket.on("disconnect", () => {
        console.log("[Socket] Disconnected from server");
      });
    }
    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();

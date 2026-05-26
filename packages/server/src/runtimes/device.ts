import { Router } from "express";
import jwt from "jsonwebtoken";
import { deviceRegistry } from "../devices";

export function mountDeviceRuntime(router: Router, jwtSecret: string) {
  router.post("/devices/pair", (req, res) => {
    const { deviceId, name, type, capabilities, osInfo } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });

    const token = req.cookies.token;
    let userId = 'anonymous';
    try {
      if (token) {
        const decoded: any = jwt.verify(token, jwtSecret);
        userId = decoded.uid || 'anonymous';
      }
    } catch { /* token invalid, use anonymous */ }

    const device = deviceRegistry.register(userId, deviceId, {
      name: name || `paired_${deviceId.slice(0, 8)}`,
      type: type || 'web',
      capabilities: capabilities || { audio: true, video: false, spatial: false, haptic: false, holographic: false },
      osInfo: osInfo || 'Paired Device',
    });

    res.json({ success: true, paired: deviceId, device, timestamp: new Date().toISOString() });
  });

  router.get("/devices", (req, res) => {
    const token = req.cookies.token;
    let userId = '';
    try {
      if (token) {
        const decoded: any = jwt.verify(token, jwtSecret);
        userId = decoded.uid;
      }
    } catch { /* token invalid, continue without auth */ }

    const userDevices = userId ? deviceRegistry.getUserDevices(userId) : [];
    const mcpDevices = deviceRegistry.getMcpDevices();
    const devices = [...userDevices, ...mcpDevices];
    const sensory = userId ? deviceRegistry.getSensoryContext(userId) : { hasAudio: false, hasVideo: false, hasSpatial: false, hasHaptic: false, hasHolographic: false, activeDeviceTypes: [], deviceCount: mcpDevices.length };
    res.json({ devices, sensoryContext: sensory });
  });
}

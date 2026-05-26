import { Router } from "express";
import jwt from "jsonwebtoken";
import { deviceRegistry } from "../devices";

export function mountDeviceRuntime(router: Router, jwtSecret: string) {
  router.post("/devices/pair", (req, res) => {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });
    res.json({ success: true, paired: deviceId, timestamp: new Date().toISOString() });
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

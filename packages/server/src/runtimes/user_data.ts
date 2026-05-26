import { Router } from "express";
import jwt from "jsonwebtoken";
import { readDB, writeDB } from "../data/db_layer";
import { broadcastPreferenceChange } from "../memory";

export function mountUserDataRuntime(router: Router, jwtSecret: string) {
  // Pet preferences — stored in db.settings as key-value
  router.get("/preferences/pet", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, jwtSecret);
      const db = readDB();
      const setting = (db.settings || []).find((s: any) => s.key === `pet_prefs_${decoded.uid}`);
      if (setting) {
        res.json(JSON.parse(setting.value));
      } else {
        res.json({ pet: null, accessories: [] });
      }
    } catch (e: any) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  router.put("/preferences/pet", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, jwtSecret);
      const { pet, accessories } = req.body || {};
      const db = readDB();
      if (!db.settings) db.settings = [];
      const key = `pet_prefs_${decoded.uid}`;
      const value = JSON.stringify({ pet: pet || null, accessories: accessories || [] });
      const existing = db.settings.findIndex((s: any) => s.key === key);
      if (existing >= 0) {
        db.settings[existing].value = value;
      } else {
        db.settings.push({ key, value });
      }
      writeDB(db);
      broadcastPreferenceChange(decoded.uid, 'pet', { pet: pet || null, accessories: accessories || [] });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // User interactions
  router.get("/interactions", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, jwtSecret);
      const db = readDB();
      const mode = req.query.mode as string | undefined;
      let userInteractions = db.interactions.filter((i: any) => i.userId === decoded.uid);
      if (mode) userInteractions = userInteractions.filter((i: any) => i.mode === mode);
      res.json(userInteractions);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  router.post("/interactions", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, jwtSecret);
      const { content, role } = req.body;
      const db = readDB();
      const newInteraction = {
        id: Math.random().toString(36).substring(2, 15),
        userId: decoded.uid,
        content,
        role,
        timestamp: new Date().toISOString()
      };
      db.interactions.push(newInteraction);
      writeDB(db);
      res.json(newInteraction);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

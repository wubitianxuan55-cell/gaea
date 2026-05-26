import { Router } from "express";
import jwt from "jsonwebtoken";
import { readDB, writeDB } from "../data/db_layer";
import { logger } from "../utils/logger";
import { personalityRegistry } from "../personality";
import { evolvePersonality } from "../personality/evolution";
import { loadEmotionalState, saveEmotionalState } from "../personality/state";
import type { PersonalityConfig } from "../personality/types";

const asyncHandler = (fn: (req: any, res: any, next?: any) => Promise<any>) =>
  (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

export interface PersonalityRuntimeDeps {
  jwtSecret: string;
  getDeepSeek: () => any;
  getGemini: () => any;
  getOpenAI: () => any;
  getAnthropic: () => any;
  getQwen: () => any;
}

export function mountPersonalityRuntime(router: Router, deps: PersonalityRuntimeDeps) {
  const { jwtSecret, getDeepSeek, getGemini, getOpenAI, getAnthropic, getQwen } = deps;

  // Lumi core personality config
  router.get("/personalities", (_req, res) => {
    const lumi = personalityRegistry.get('lumi');
    res.json([lumi]);
  });

  router.get("/personalities/:id", (req, res) => {
    const config = personalityRegistry.get(req.params.id);
    if (!config) return res.status(404).json({ error: "Personality not found" });
    res.json(config);
  });

  router.get("/personality/:id/evolution", (req, res) => {
    const config = personalityRegistry.get(req.params.id);
    if (!config) return res.status(404).json({ error: "Personality not found" });
    const history = personalityRegistry.getEvolutionHistory(req.params.id);
    const evolutionConfig = personalityRegistry.getEvolutionConfig(req.params.id);
    res.json({
      personalityId: req.params.id,
      currentVector: config.personalityVector || null,
      version: config.version,
      evolutionConfig,
      history,
    });
  });

  // Growth journal
  router.get("/personality/:id/growth-journal", (req, res) => {
    try {
      const token = req.cookies.token;
      let uid = 'anonymous';
      if (token) {
        try { const decoded: any = jwt.verify(token, jwtSecret); uid = decoded.uid; } catch {}
      }
      const db = readDB();
      const limit = parseInt(req.query.limit as string) || 14;
      const journalEntries = (db.memories || [])
        .filter((m: any) =>
          m.userId === uid &&
          m.keywords?.includes('growth_journal') &&
          m.type === 'knowledge'
        )
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, limit)
        .map((m: any) => ({
          id: m.id, content: m.content, date: m.createdAt?.slice(0, 10) || '', tier: m.tier,
        }));
      const dataEntries = (db.memories || [])
        .filter((m: any) =>
          m.userId === uid &&
          m.keywords?.includes('growth_journal_data')
        )
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, limit)
        .map((m: any) => {
          try {
            return { id: m.id, date: m.createdAt?.slice(0, 10) || '', data: JSON.parse(m.content) };
          } catch {
            return { id: m.id, date: m.createdAt?.slice(0, 10) || '', data: null };
          }
        });
      res.json({
        personalityId: req.params.id,
        journalEntries,
        statsEntries: dataEntries,
        count: journalEntries.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger personality evolution
  router.post("/personality/:id/evolve", asyncHandler(async (req, res) => {
    try {
      const config = personalityRegistry.get(req.params.id);
      if (!config) return res.status(404).json({ error: "Personality not found" });
      const token = req.cookies.token;
      let uid = 'anonymous';
      if (token) {
        try { const decoded: any = jwt.verify(token, jwtSecret); uid = decoded.uid; } catch {}
      }
      const emotionalState = loadEmotionalState(uid);
      const evolutionConfig = personalityRegistry.getEvolutionConfig(req.params.id);
      const step = await evolvePersonality(
        config, uid, emotionalState.connection,
        getDeepSeek, getGemini, getOpenAI, getAnthropic, getQwen,
        evolutionConfig,
      );
      if (step) {
        personalityRegistry.applyEvolution(req.params.id, step);
        (req as any)._lumiPersonalityUpdate = { id: req.params.id, step };
      }
      // Persist emotional state
      saveEmotionalState(uid, emotionalState);
      res.json({
        success: true,
        version: step?.version,
        changes: step?.mutations || [],
        reasoning: step?.narrative || '',
      });
    } catch (err: any) {
      logger.error("Personality evolution failed", err);
      res.status(500).json({ error: err.message });
    }
  }));
}

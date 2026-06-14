// Route aggregator — mounts all shared routes on the API router
import { Router } from "express";
import { Server } from "socket.io";
import { mountPersonalityRoutes } from "../routes/personality_routes";
import { mountMcpRoutes } from "../routes/mcp_routes";
import { mountDeviceRoutes } from "../routes/device_routes";
import { mountSystemRoutes } from "../routes/system_routes";
import { mountChatRoutes } from "../routes/chat_routes";
import { mountPreferencesRoutes } from "../routes/preferences_routes";
import { mountInteractionsRoutes } from "../routes/interactions_routes";
import { mountAuthRoutes } from "../routes/auth";
import { mountMemoryRoutes } from "../routes/memory_routes";
import { mountConversationRoutes } from "../routes/conversations";
import { mountAgentRoutes } from "../routes/agent_routes";
import { mountSkillRoutes } from "../routes/skill_routes";
import { mountMarketplaceRoutes } from "../routes/marketplace_routes";
import { mountMiscRoutes } from "../routes/misc_routes";
import { mountContactsRoutes } from "../routes/contacts_routes";
import { mountNotificationRoutes } from "../routes/notifications";
import { mountCanvasRoutes } from "../routes/canvas_routes";
import { autonomyRoutes } from "../routes/autonomy_routes";
import { mountExploreRoutes, mountPlanRoutes } from "../routes/plan_explore_routes";

interface RouteContext {
  apiRouter: Router;
  jwtSecret: string;
  llm: {
    getDeepSeek: any; getOllama: any; isOllamaAvailable: any; getLmStudio: any; isLmStudioAvailable: any;
  };
  getCookieOptions: () => { httpOnly: true; secure: true; sameSite: "none"; maxAge: number };
  io: Server;
}

export function mountAllRoutes({ apiRouter, jwtSecret, llm, getCookieOptions, io }: RouteContext) {
  const llmGetters = {
    getDeepSeek: llm.getDeepSeek,
    getGemini: () => null,
    getOpenAI: () => null,
    getAnthropic: () => null,
    getQwen: () => null,
    getOllama: llm.getOllama,
    getLmStudio: llm.getLmStudio,
  };

  // Personality, MCP, Device management
  mountPersonalityRoutes(apiRouter, jwtSecret, llmGetters);
  mountMcpRoutes(apiRouter);
  mountDeviceRoutes(apiRouter, jwtSecret);

  // System routes (health, tools, llm, settings, stats, ecosystem, modules)
  mountSystemRoutes(apiRouter, jwtSecret, io);

  // AI Chat
  mountChatRoutes(apiRouter, jwtSecret, llmGetters);

  // Auth
  mountAuthRoutes(apiRouter, jwtSecret, getCookieOptions);

  // Agents
  mountAgentRoutes(apiRouter, jwtSecret, llmGetters);

  // Preferences & Interactions
  mountPreferencesRoutes(apiRouter, jwtSecret);
  mountInteractionsRoutes(apiRouter, jwtSecret);

  // Memory & Conversation
  mountMemoryRoutes(apiRouter, jwtSecret, llmGetters);
  mountConversationRoutes(apiRouter, jwtSecret);

  // Skills & Marketplace
  mountSkillRoutes(apiRouter, jwtSecret, llmGetters, io);
  mountMarketplaceRoutes(apiRouter, jwtSecret, io);

  // Contacts
  mountContactsRoutes(apiRouter, jwtSecret);

  // Notifications
  mountNotificationRoutes(apiRouter);

  // Canvas Workbench
  mountCanvasRoutes(apiRouter, jwtSecret);

  // System Exploration & Plans
  mountExploreRoutes(apiRouter);
  mountPlanRoutes(apiRouter);

  // Autonomy
  apiRouter.use('/autonomy', autonomyRoutes());

  // Misc (founder vision, feedback, admin config, Org chat)
  mountMiscRoutes(apiRouter, jwtSecret, llmGetters);
}

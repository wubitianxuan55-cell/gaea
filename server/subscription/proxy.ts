/**
 * LLM API Proxy — enforces subscription limits before routing to LLM providers.
 *
 * Every LLM call goes through here. On a cloud server, this is the ONLY
 * service that needs your API keys. Local servers forward LLM requests here.
 */
import { checkTokenLimit, addTokensUsed, getSubscriptionWithPlan } from './db';
import type { SubscriptionPlan } from './types';
import { getPlan } from './types';

export interface ProxyRequest {
  userId: string;
  provider: string;           // 'qwen' | 'deepseek' | 'gemini' | 'openai' | 'anthropic'
  model: string;
  maxTokens?: number;
}

export interface ProxyResult {
  allowed: boolean;
  reason?: string;
  providerRestricted?: boolean;
  tokenLimitReached?: boolean;
  plan?: SubscriptionPlan;
}

/**
 * Check if a user is allowed to make an LLM call with the given provider.
 * Does NOT record tokens — call `recordUsage` after the LLM responds.
 */
export function checkLLMAccess(req: ProxyRequest): ProxyResult {
  const { subscription, plan } = getSubscriptionWithPlan(req.userId);

  // Check provider access
  if (!plan.llmProviders.includes(req.provider)) {
    return {
      allowed: false,
      reason: `Provider "${req.provider}" is not included in your ${plan.name} plan. Upgrade to access more LLMs.`,
      providerRestricted: true,
      plan,
    };
  }

  // Check token limit
  const { allowed, used, cap, remaining } = checkTokenLimit(req.userId);
  if (!allowed) {
    return {
      allowed: false,
      reason: `Monthly token limit reached (${used.toLocaleString()} / ${cap.toLocaleString()}). Upgrade your plan or wait for the next billing cycle.`,
      tokenLimitReached: true,
      plan,
    };
  }

  return {
    allowed: true,
    plan,
  };
}

/**
 * Record token usage after a successful LLM call.
 * Returns updated usage stats.
 */
export function recordUsage(userId: string, tokens: number) {
  const sub = addTokensUsed(userId, tokens);
  const plan = getPlan(sub.planId);
  return {
    used: sub.tokensUsedThisMonth,
    cap: sub.monthlyTokenCap,
    remaining: Math.max(0, sub.monthlyTokenCap - sub.tokensUsedThisMonth),
    plan: plan?.name || 'Free',
  };
}

/**
 * Estimate token count from text. Rough heuristic:
 *   English: ~1.3 tokens/word
 *   Chinese: ~1.5 tokens/character
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const nonChinese = text.replace(/[一-鿿]/g, '');
  const words = nonChinese.split(/\s+/).filter(Boolean).length;
  return Math.ceil(chineseChars * 1.5 + words * 1.3);
}

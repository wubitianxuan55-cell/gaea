import { Router } from "express";
import OpenAI from "openai";
import { checkLLMAccess, recordUsage, estimateTokens } from "../subscription/proxy";
import { runWithTools } from "../llm/adapter";
import { toolRegistry } from "../tools/registry";
import { recordLatency } from "../monitor/latency_store";
import { optionalAuth } from "../middleware/auth";

export function mountChatRoutes(router: Router, _jwtSecret: string, llm: {
  getDeepSeek: any;
}) {
  const asyncHandler = (fn: (req: any, res: any, next?: any) => Promise<any>) =>
    (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

  router.post("/ai/chat", optionalAuth, asyncHandler(async (req, res) => {
    const { provider = "deepseek", model = "deepseek-chat", messages, prompt } = req.body;
    const userKey = req.headers["x-api-key"] as string;
    const userId = req.user?.uid || 'anonymous';

    const isBYOK = userKey && userKey.length > 5;

    if (!isBYOK) {
      const access = checkLLMAccess({ userId, provider, model: model || '' });
      if (!access.allowed) {
        return res.status(402).json({ error: access.reason, code: access.tokenLimitReached ? 'TOKEN_LIMIT' : 'PROVIDER_RESTRICTED' });
      }
    }

    try {
      let responseText = '';
      const systemInstruction = "你是一个名为 Gaea 的本地核心智能体。你致力于全息空间计算和独立 AI 人格生成进化。你的目标是打造全息 AI 世界和文明。你应当表现得专业、深邃且具有前瞻性。你的回复应当简洁且富有启发性。";

      if (isBYOK) {
        const llmStart = Date.now();
        const client = new OpenAI({ apiKey: userKey, baseURL: "https://api.deepseek.com/v1" });
        const response = await client.chat.completions.create({
          model: model || "deepseek-chat",
          messages: messages || [{ role: "user", content: prompt }]
        });
        responseText = response.choices[0].message.content || '';
        recordLatency('llm', Date.now() - llmStart);
      } else {
        const normalizedMessages: any[] = [
          { role: 'system', content: systemInstruction },
          ...(messages || [{ role: 'user', content: prompt }]).map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content || ''
          }))
        ];

        const stream = req.query.stream === 'true';

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const result = await runWithTools(
            normalizedMessages,
            toolRegistry,
            { provider, model: model || 'deepseek-chat', userId },
            undefined, 3,
            llm.getDeepSeek,
            undefined, undefined, undefined, undefined,
            (chunk) => {
              res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            },
          );

          responseText = result.text || '';
          const tokens = estimateTokens(
            normalizedMessages.map((m: any) => m.content || '').join(' ') + ' ' + responseText
          );
          recordUsage(userId, tokens);
          res.write(`data: ${JSON.stringify({ done: true, text: responseText, toolCalls: result.toolCalls.length })}\n\n`);
          return res.end();
        }

        const result = await runWithTools(
          normalizedMessages,
          toolRegistry,
          { provider, model: model || 'deepseek-chat', userId },
          undefined, 3,
          llm.getDeepSeek,
        );

        responseText = result.text || '';
        const tokens = estimateTokens(
          normalizedMessages.map((m: any) => m.content || '').join(' ') + ' ' + responseText
        );
        const usage = recordUsage(userId, tokens);
        return res.json({ text: responseText, usage, toolCalls: result.toolCalls.length });
      }

      res.json({ text: responseText });
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  }));
}

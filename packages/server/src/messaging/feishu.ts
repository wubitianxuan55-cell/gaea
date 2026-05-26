/**
 * Feishu Message Adapter — Bot integration via Feishu Open API.
 *
 * Setup:
 *   1. Go to https://open.feishu.cn/app → Create Custom App
 *   2. Enable "Bot" capability
 *   3. Set event subscription URL to https://your-server/api/feishu/events
 *   4. Subscribe to: im.message.receive_v1
 *   5. Copy App ID + App Secret → .env as FEISHU_APP_ID / FEISHU_APP_SECRET
 */
import crypto from 'crypto';
import type {
  MessageAdapter,
  IncomingMessage,
  OutgoingMessage,
  CardPayload,
  MessagingPlatform,
} from './types';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string; // optional extra security
}

export class FeishuAdapter implements MessageAdapter {
  readonly platform: MessagingPlatform = 'feishu';
  private config: FeishuConfig;
  private tenantToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  // ── Reinitialize after config change ──

  reload(config: FeishuConfig): void {
    this.config = config;
    this.tenantToken = null;
    this.tokenExpiry = 0;
  }

  // ── Token Management ──

  private async getTenantToken(): Promise<string> {
    if (this.tenantToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.tenantToken;
    }
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Feishu auth error: ${data.msg || data.error}`);
    this.tenantToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire || 7200) * 1000;
    return this.tenantToken!;
  }

  // ── Webhook Verification ──

  verifyWebhook(body: Record<string, any>): boolean {
    // Feishu URL challenge on first setup
    if (body.type === 'url_verification') {
      return true;
    }
    return true;
  }

  // ── Event Parsing ──

  parseEvent(body: any): IncomingMessage | null {
    // Feishu wraps events in: { schema: "2.0", header: {...}, event: {...} }
    const eventData = body.event || body;
    const header = body.header || {};

    // URL verification challenge
    if (body.type === 'url_verification' || eventData.type === 'url_verification') {
      // This is handled by the route, not parseEvent
      return null;
    }

    const eventType = eventData.type || header.event_type || '';

    if (eventType !== 'im.message.receive_v1') return null;

    const event = eventData.event || eventData;
    const message = event?.message;
    if (!message) return null;

    // Only handle text messages for now
    if (message.message_type !== 'text') return null;

    const textContent = this.parseTextContent(message.content);
    if (!textContent) return null;

    const chatId = message.chat_id || '';
    const isGroup = chatId.startsWith('oc_');

    return {
      platform: 'feishu',
      userId: event?.sender?.sender_id?.open_id || message.open_id || 'unknown',
      userName: event?.sender?.sender_id?.open_id || 'FeishuUser',
      chatId,
      chatType: isGroup ? 'group' : 'private',
      messageId: message.message_id || `${Date.now()}`,
      text: textContent,
      raw: { event: eventData, message },
      timestamp: new Date(Number(message.create_time) || Date.now()).toISOString(),
    };
  }

  private parseTextContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return parsed.text || '';
    } catch {
      return content;
    }
  }

  // ── Send Message ──

  async sendMessage(chatId: string, message: OutgoingMessage): Promise<string> {
    const token = await this.getTenantToken();
    const body: Record<string, any> = {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: message.text }),
    };

    const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (data.code !== 0) {
      console.error(`[Feishu] Send error:`, data.msg);
      throw new Error(`Feishu send failed: ${data.msg}`);
    }
    return data.data?.message_id || '';
  }

  async sendCard(chatId: string, card: CardPayload): Promise<string> {
    const token = await this.getTenantToken();
    const feishuCard = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: card.title },
        ...(card.subtitle ? { subtitle: { tag: 'plain_text', content: card.subtitle } } : {}),
        ...(card.color ? { template: card.color } : {}),
      },
      elements: [
        {
          tag: 'markdown',
          content: card.body,
        },
        ...(card.linkUrl ? [{
          tag: 'action',
          actions: [{
            tag: 'button',
            text: { tag: 'plain_text', content: '查看详情' },
            type: 'primary',
            url: card.linkUrl,
          }],
        }] : []),
      ],
    };

    const body: Record<string, any> = {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(feishuCard),
    };

    const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (data.code !== 0) {
      console.error(`[Feishu] Card send error:`, data.msg);
      throw new Error(`Feishu card send failed: ${data.msg}`);
    }
    return data.data?.message_id || '';
  }

  // ── Reply to specific message ──

  async replyMessage(messageId: string, text: string): Promise<string> {
    const token = await this.getTenantToken();
    const body = {
      content: JSON.stringify({ text }),
      msg_type: 'text',
    };

    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (data.code !== 0) {
      console.error(`[Feishu] Reply error:`, data.msg);
      throw new Error(`Feishu reply failed: ${data.msg}`);
    }
    return data.data?.message_id || '';
  }
}

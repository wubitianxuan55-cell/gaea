/**
 * Lumi Messaging — Unified messaging layer.
 * Supports: Feishu, Telegram, WeChat, Web Chat
 */
export type {
  MessagingPlatform,
  IncomingMessage,
  OutgoingMessage,
  MessageButton,
  CardPayload,
  MessageAdapter,
  MessageHandler,
} from './types';

export { FeishuAdapter } from './feishu';
export type { FeishuConfig } from './feishu';
export { createMessagingRoutes } from './routes';

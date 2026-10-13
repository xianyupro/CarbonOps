/**
 * AI 智能助手类型定义。
 */

export interface AiChatSession {
  id: number;
  title: string;
  messageCount: number;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AiChatSessionDetail {
  session: AiChatSession;
  messages: AiChatMessage[];
}

export interface AiChatStatus {
  available: boolean;
  model: string;
}

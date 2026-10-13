import type { Metadata } from "next";
import { AssistantWorkspace } from "@/components/ai/assistant-workspace";

export const metadata: Metadata = {
  title: "AI 智能助手 - CarbonOps",
};

/** AI 智能助手 —— 独立的 AI 交互界面（会话管理 + 流式对话）。 */
export default function AssistantPage() {
  return <AssistantWorkspace />;
}

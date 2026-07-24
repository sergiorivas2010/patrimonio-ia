export interface Env {
  AI: Ai;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

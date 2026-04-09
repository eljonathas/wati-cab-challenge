import type { AgentSession } from "../session.ts";

export interface SessionListItem {
  readonly id: string;
  readonly updatedAt: string;
  readonly turnCount: number;
  readonly preview: string;
}

export interface SessionStore {
  load(sessionId: string): Promise<AgentSession>;
  save(session: AgentSession): Promise<void>;
  list(): Promise<SessionListItem[]>;
}

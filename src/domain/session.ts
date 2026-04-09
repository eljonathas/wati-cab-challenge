import type { AgentOutcome, AgentPlan } from "./agent.ts";

export interface SessionMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface AgentPlanTurn {
  readonly kind: "plan";
  readonly id: string;
  readonly createdAt: string;
  readonly instruction: string;
  readonly thinking: string;
  readonly plan: AgentPlan;
  readonly outcome?: AgentOutcome;
  readonly cancelledAt?: string;
}

export interface AgentMessageTurn {
  readonly kind: "message";
  readonly id: string;
  readonly createdAt: string;
  readonly instruction: string;
  readonly thinking: string;
  readonly content: string;
}

export interface AgentResultTurn {
  readonly kind: "result";
  readonly id: string;
  readonly createdAt: string;
  readonly thinking: string;
  readonly summary: string;
}

export type AgentSessionTurn =
  | AgentPlanTurn
  | AgentMessageTurn
  | AgentResultTurn;

export interface AgentSession {
  readonly id: string;
  readonly turns: AgentSessionTurn[];
}

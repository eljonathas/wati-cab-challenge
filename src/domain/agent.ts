export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export interface ToolCall {
  readonly id: string;
  readonly tool: string;
  readonly input: Record<string, Json>;
  readonly reason: string;
  readonly forEach?: string;
}

export interface AgentPlan {
  readonly objective: string;
  readonly assumptions: string[];
  readonly steps: ToolCall[];
}

export interface AgentOutcome {
  readonly plan: AgentPlan;
  readonly results: ToolExecutionResult[];
}

export interface AgentBaseResponse {
  readonly thinking: string;
  readonly raw: string;
}

export interface AgentPlanResponse extends AgentBaseResponse {
  readonly type: "plan";
  readonly plan: AgentPlan;
}

export interface AgentMessageResponse extends AgentBaseResponse {
  readonly type: "message";
  readonly content: string;
}

export type AgentResponse = AgentPlanResponse | AgentMessageResponse;

export interface ToolExecutionResult {
  readonly stepId: string;
  readonly tool: string;
  readonly ok: boolean;
  readonly data: unknown;
}

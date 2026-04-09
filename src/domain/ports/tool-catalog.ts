import type { Json } from "../agent.ts";

export interface ToolParamSchema {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "array" | "object";
  readonly description: string;
  readonly required?: boolean;
  readonly items?: ToolParamSchema;
}

export interface ToolDefinition {
  readonly key: string;
  readonly description: string;
  readonly parameters: ToolParamSchema[];
}

export interface ToolExecutor {
  list(): ToolDefinition[];
  execute(key: string, input: Record<string, Json>): Promise<unknown>;
}

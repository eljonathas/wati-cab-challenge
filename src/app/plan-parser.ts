import type { AgentPlan, AgentResponse } from "../domain/agent.ts";

export class PlanParser {
  parse(raw: string, thinking: string): AgentResponse {
    const json = this.extractJson(raw);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      // If JSON parsing fails entirely, treat as conversational message
      return { type: "message", content: raw.trim(), thinking, raw };
    }

    // The LLM returned a message response
    if (parsed.type === "message" && typeof parsed.content === "string") {
      return { type: "message", content: parsed.content, thinking, raw };
    }

    // Try to parse as a plan
    try {
      const plan = this.toPlan(parsed);
      return { type: "plan", plan, thinking, raw };
    } catch {
      // If plan parsing fails, treat the objective or raw as a message
      const fallback =
        typeof parsed.content === "string"
          ? parsed.content
          : typeof parsed.objective === "string"
            ? parsed.objective
            : raw.trim();
      return { type: "message", content: fallback, thinking, raw };
    }
  }

  private toPlan(parsed: Record<string, unknown>): AgentPlan {
    return {
      objective: this.asString(parsed.objective, "objective"),
      assumptions: this.asStringArray(parsed.assumptions),
      steps: this.asSteps(parsed.steps),
    };
  }

  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) return trimmed;

    const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch?.[1]) return fenceMatch[1].trim();

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

    return trimmed;
  }

  private asString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Invalid plan field: ${field}`);
    }
    return value;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }

  private asSteps(value: unknown): AgentPlan["steps"] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error("Invalid plan field: steps");
    }

    return value.map((item) => {
      const step = item as Record<string, unknown>;
      const id = this.asString(step.id, "id");
      const tool = this.asString(step.tool, "tool");
      const reason = this.asString(step.reason, "reason");
      const input =
        typeof step.input === "object" && step.input !== null
          ? (step.input as Record<string, import("../domain/agent.ts").Json>)
          : {};
      const forEach =
        typeof step.forEach === "string" && step.forEach.trim()
          ? step.forEach
          : undefined;
      return { id, tool, reason, input, forEach };
    });
  }
}

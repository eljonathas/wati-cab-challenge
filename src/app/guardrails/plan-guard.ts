import type { AgentPlan, ToolCall } from "../../domain/agent.ts";
import type { ToolDefinition } from "../../domain/ports/tool-catalog.ts";

export class PlanGuard {
  constructor(private readonly tools: ToolDefinition[]) {}

  validate(plan: AgentPlan): void {
    if (!plan.objective.trim()) {
      throw new Error("Plan objective is empty.");
    }

    if (plan.steps.length === 0) {
      throw new Error("Plan must contain at least one step.");
    }

    for (const step of plan.steps) {
      this.ensureKnownTool(step);
    }

    const ids = new Set<string>();
    for (const step of plan.steps) {
      if (ids.has(step.id)) {
        throw new Error(`Duplicated step id: ${step.id}`);
      }
      ids.add(step.id);

      if (step.forEach && !step.forEach.startsWith("$each:")) {
        throw new Error(`Invalid forEach syntax in step ${step.id}`);
      }
    }
  }

  private ensureKnownTool(step: ToolCall): void {
    const exists = this.tools.some((tool) => tool.key === step.tool);
    if (!exists) {
      throw new Error(`Unknown tool: ${step.tool}`);
    }
  }
}

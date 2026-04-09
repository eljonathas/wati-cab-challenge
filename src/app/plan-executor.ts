import type {
  AgentOutcome,
  AgentPlan,
  Json,
  ToolCall,
  ToolExecutionResult,
} from "../domain/agent.ts";
import type { ToolExecutor } from "../domain/ports/tool-catalog.ts";

type StepResults = Map<string, unknown>;

export class PlanExecutor {
  constructor(private readonly tools: ToolExecutor) {}

  async execute(plan: AgentPlan): Promise<AgentOutcome> {
    const results: ToolExecutionResult[] = [];
    const state: StepResults = new Map();

    for (const step of plan.steps) {
      try {
        const data = await this.executeStep(step, state);
        state.set(step.id, data);
        results.push({ stepId: step.id, tool: step.tool, ok: true, data });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          stepId: step.id,
          tool: step.tool,
          ok: false,
          data: { error: message },
        });
        // Stop execution on first failure — partial results are preserved
        break;
      }
    }

    return { plan, results };
  }

  private async executeStep(
    step: ToolCall,
    state: StepResults,
  ): Promise<unknown> {
    if (!step.forEach) {
      return this.tools.execute(
        step.tool,
        this.resolveInput(step.input, state),
      );
    }

    const sourceId = step.forEach.replace("$each:", "");
    const source = state.get(sourceId);
    if (!Array.isArray(source)) {
      throw new Error(
        `Step ${step.id} expected array result from ${sourceId}.`,
      );
    }

    const outputs: unknown[] = [];
    for (const item of source) {
      const input = this.resolveInput(step.input, state, item);
      outputs.push(await this.tools.execute(step.tool, input));
    }

    return outputs;
  }

  private resolveInput(
    value: Record<string, Json>,
    state: StepResults,
    item?: unknown,
  ): Record<string, Json> {
    return this.resolveValue(value, state, item) as Record<string, Json>;
  }

  private resolveValue(value: Json, state: StepResults, item?: unknown): Json {
    if (typeof value === "string") {
      return this.resolveString(value, state, item);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.resolveValue(entry, state, item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          this.resolveValue(entry, state, item),
        ]),
      );
    }

    return value;
  }

  private resolveString(
    value: string,
    state: StepResults,
    item?: unknown,
  ): Json {
    if (value.startsWith("$item.")) {
      return this.readPath(item, value.slice("$item.".length));
    }

    if (value.startsWith("$ref:")) {
      const [stepId, ...path] = value.slice("$ref:".length).split(".");
      if (!stepId) return null;
      return this.readPath(state.get(stepId), path.join("."));
    }

    return value;
  }

  private readPath(source: unknown, path: string): Json {
    if (!path) return this.asJson(source);

    const result = path.split(".").reduce<unknown>((current, part) => {
      if (
        current &&
        typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, source);

    return this.asJson(result);
  }

  private asJson(value: unknown): Json {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.asJson(entry));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.asJson(entry)]),
      );
    }

    return null;
  }
}

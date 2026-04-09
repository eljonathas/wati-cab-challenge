import type {
  AgentOutcome,
  AgentPlan,
  AgentResponse,
} from "../domain/agent.ts";
import type { LlmProvider } from "../domain/ports/llm-provider.ts";
import type { ToolExecutor } from "../domain/ports/tool-catalog.ts";
import type { SessionMessage } from "../domain/session.ts";
import { AgentSystemPromptFactory } from "./agent-system-prompt.ts";
import { PlanGuard } from "./guardrails/plan-guard.ts";
import { PlanExecutor } from "./plan-executor.ts";
import { PlanParser } from "./plan-parser.ts";

export class RunAgentUseCase {
  private readonly promptFactory = new AgentSystemPromptFactory();
  private readonly parser = new PlanParser();
  private readonly guard: PlanGuard;
  private readonly executor: PlanExecutor;

  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly toolExecutor: ToolExecutor,
  ) {
    this.guard = new PlanGuard(toolExecutor.list());
    this.executor = new PlanExecutor(toolExecutor);
  }

  async respond(
    instruction: string,
    history: SessionMessage[] = [],
    callbacks?: {
      onThinkingChunk?(chunk: string): void;
      signal?: AbortSignal;
    },
  ): Promise<AgentResponse> {
    const response = await this.llmProvider.generateStructuredText({
      systemPrompt: this.promptFactory.create(this.toolExecutor.list()),
      userPrompt: instruction,
      history,
      callbacks,
      signal: callbacks?.signal,
    });

    const result = this.parser.parse(response.content, response.thinking);

    if (result.type === "plan") {
      this.guard.validate(result.plan);
    }

    return result;
  }

  async execute(plan: AgentPlan): Promise<AgentOutcome> {
    this.guard.validate(plan);
    return this.executor.execute(plan);
  }
}

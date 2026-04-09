import { randomUUID } from "node:crypto";
import { RunAgentUseCase } from "./app/run-agent-use-case.ts";
import { OllamaProvider } from "./infra/llm/ollama-provider.ts";
import { TerminalAppService } from "./infra/ink/terminal-app-service.ts";
import type { TerminalOptions } from "./infra/ink/terminal-app/index.tsx";
import { FileSessionStore } from "./infra/session/file-session-store.ts";
import { ToolRegistry } from "./infra/tools/tool-registry.ts";
import { MockWatiGateway } from "./infra/wati/mock-wati-gateway.ts";
import { WatiTools } from "./infra/wati/wati-tools.ts";

export function bootstrap(): {
  app: TerminalAppService;
  options: TerminalOptions;
} {
  const registry = new ToolRegistry();
  registry.register(new WatiTools(new MockWatiGateway()));

  const useCase = new RunAgentUseCase(
    new OllamaProvider(Bun.env.OLLAMA_MODEL ?? "gemma4:e4b"),
    registry,
  );

  const sessionId = randomUUID();

  const app = new TerminalAppService(
    useCase,
    new FileSessionStore(),
    sessionId,
  );

  return { app, options: { sessionId } };
}

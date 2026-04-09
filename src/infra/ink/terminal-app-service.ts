import { randomUUID } from "node:crypto";
import { SessionHistoryBuilder } from "../../app/session-history.ts";
import { RunAgentUseCase } from "../../app/run-agent-use-case.ts";
import type { SessionStore } from "../../domain/ports/session-store.ts";
import type { AgentResponse } from "../../domain/agent.ts";
import type {
  AgentSession,
  AgentSessionTurn,
  AgentPlanTurn,
  AgentResultTurn,
} from "../../domain/session.ts";
import type { SessionListItem } from "../../domain/ports/session-store.ts";

export interface SubmitCallbacks {
  onThinkingChunk?(chunk: string): void;
  signal?: AbortSignal;
}

export class TerminalAppService {
  private readonly historyBuilder = new SessionHistoryBuilder();
  private currentSessionId: string;

  constructor(
    private readonly useCase: RunAgentUseCase,
    private readonly sessionStore: SessionStore,
    readonly sessionId: string,
  ) {
    this.currentSessionId = sessionId;
  }

  loadSession(): Promise<AgentSession> {
    return this.sessionStore.load(this.currentSessionId);
  }

  getSessionId(): string {
    return this.currentSessionId;
  }

  listSessions(): Promise<SessionListItem[]> {
    return this.sessionStore.list();
  }

  async resumeSession(sessionId: string): Promise<AgentSession> {
    const sessions = await this.sessionStore.list();
    if (!sessions.some((session) => session.id === sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.sessionStore.load(sessionId);
    this.currentSessionId = session.id;
    return session;
  }

  isConfirmation(text: string): boolean {
    return ["yes", "y", "confirm", "ok", "execute", "sim", "s"].includes(
      text.trim().toLowerCase(),
    );
  }

  isRejection(text: string): boolean {
    return ["no", "n", "cancel", "stop", "nao", "não"].includes(
      text.trim().toLowerCase(),
    );
  }

  hasPendingPlan(session: AgentSession): boolean {
    const turn = session.turns.at(-1);
    return Boolean(
      turn && turn.kind === "plan" && !turn.outcome && !turn.cancelledAt,
    );
  }

  async cancelLastPlan(session: AgentSession): Promise<AgentSession> {
    const turn = session.turns.at(-1);
    if (!turn || turn.kind !== "plan") return session;

    const nextSession = this.historyBuilder.cancelTurn(session, turn.id);
    await this.sessionStore.save(nextSession);
    return nextSession;
  }

  async submitInstruction(
    session: AgentSession,
    instruction: string,
    callbacks?: SubmitCallbacks,
  ): Promise<{
    session: AgentSession;
    turn: AgentSessionTurn;
    response: AgentResponse;
  }> {
    const response = await this.useCase.respond(
      instruction,
      this.historyBuilder.toMessages(session),
      callbacks,
    );

    const turn: AgentSessionTurn =
      response.type === "plan"
        ? {
            kind: "plan",
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            instruction,
            thinking: response.thinking,
            plan: response.plan,
          }
        : {
            kind: "message",
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            instruction,
            thinking: response.thinking,
            content: response.content,
          };

    const nextSession = this.historyBuilder.appendTurn(session, turn);
    await this.sessionStore.save(nextSession);
    return { session: nextSession, turn, response };
  }

  async executeLastPlan(
    session: AgentSession,
    callbacks?: SubmitCallbacks,
  ): Promise<{ session: AgentSession; outcome: AgentPlanTurn["outcome"] }> {
    const turn = session.turns.at(-1);
    if (!turn || turn.kind !== "plan") {
      throw new Error("No planned turn available.");
    }

    const outcome = await this.useCase.execute(turn.plan);
    const sessionWithOutcome = this.historyBuilder.updateOutcome(
      session,
      turn.id,
      outcome,
    );

    // Send results back to the agent for a conversational interpretation
    const interpretation = await this.useCase.respond(
      "[Execution completed. Summarize the results for the user. If there were errors, help diagnose what went wrong.]",
      this.historyBuilder.toMessages(sessionWithOutcome),
      callbacks,
    );

    const resultTurn: AgentResultTurn = {
      kind: "result",
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      thinking: interpretation.thinking,
      summary:
        interpretation.type === "message"
          ? interpretation.content
          : "Execution complete.",
    };

    const nextSession = this.historyBuilder.appendResultTurn(
      sessionWithOutcome,
      resultTurn,
    );
    await this.sessionStore.save(nextSession);
    return { session: nextSession, outcome };
  }
}

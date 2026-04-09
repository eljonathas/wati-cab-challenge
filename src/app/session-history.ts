import type {
  AgentSession,
  AgentSessionTurn,
  AgentPlanTurn,
  AgentResultTurn,
  SessionMessage,
} from "../domain/session.ts";

export function formatPlanTurnMarkdown(turn: AgentPlanTurn): string {
  const lines = [
    "### Plan preview",
    turn.plan.objective,
  ];

  if (turn.plan.steps.length > 0) {
    lines.push("");
    lines.push("### Proposed calls");
  }

  for (const [index, step] of turn.plan.steps.entries()) {
    lines.push(`#### ${index + 1}. \`${step.tool}\``);
    lines.push(step.reason);
    if (step.forEach) {
      lines.push(`Runs for each item from \`${step.forEach.replace("$each:", "")}\`.`);
    }
    lines.push("```json");
    lines.push(indentJson(step.input));
    lines.push("```");
    if (index < turn.plan.steps.length - 1) {
      lines.push("");
    }
  }

  if (turn.plan.assumptions.length > 0) {
    lines.push("");
    lines.push("### Assumptions");
    for (const assumption of turn.plan.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  if (turn.cancelledAt) {
    lines.push("");
    lines.push("_Cancelled._");
    return lines.join("\n");
  }

  if (!turn.outcome) {
    lines.push("");
    lines.push("Reply `yes` to run, `no` to cancel, or describe what to change.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("### Results");

  for (const [index, result] of turn.outcome.results.entries()) {
    const status = result.ok ? "Succeeded" : "Failed";
    lines.push(`#### ${index + 1}. \`${result.tool}\` ${status.toLowerCase()}`);
    lines.push("```json");
    lines.push(indentJson(result.data));
    lines.push("```");
    if (index < turn.outcome.results.length - 1) {
      lines.push("");
    }
  }

  if (turn.outcome.results.length === 0) {
    lines.push("- No tool calls were executed.");
  }

  return lines.join("\n");
}

export class SessionHistoryBuilder {
  toMessages(session: AgentSession): SessionMessage[] {
    return session.turns.flatMap((turn): SessionMessage[] => {
      if (turn.kind === "result") {
        return [
          { role: "user", content: "[Execution completed. Summarize the results for the user.]" },
          { role: "assistant", content: turn.summary },
        ];
      }

      const messages: SessionMessage[] = [
        { role: "user", content: turn.instruction },
      ];

      if (turn.kind === "message") {
        messages.push({ role: "assistant", content: turn.content });
      } else {
        messages.push({ role: "assistant", content: formatPlanTurnMarkdown(turn) });
      }

      return messages;
    });
  }

  appendResultTurn(session: AgentSession, turn: AgentResultTurn): AgentSession {
    return { ...session, turns: [...session.turns, turn] };
  }

  appendTurn(session: AgentSession, turn: AgentSessionTurn): AgentSession {
    return { ...session, turns: [...session.turns, turn] };
  }

  updateOutcome(
    session: AgentSession,
    turnId: string,
    outcome: AgentPlanTurn["outcome"],
  ): AgentSession {
    return {
      ...session,
      turns: session.turns.map((turn) =>
        turn.id === turnId && turn.kind === "plan"
          ? { ...turn, outcome }
          : turn,
      ),
    };
  }

  cancelTurn(session: AgentSession, turnId: string): AgentSession {
    return {
      ...session,
      turns: session.turns.map((turn) =>
        turn.id === turnId && turn.kind === "plan"
          ? { ...turn, cancelledAt: new Date().toISOString() }
          : turn,
      ),
    };
  }
}

function indentJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

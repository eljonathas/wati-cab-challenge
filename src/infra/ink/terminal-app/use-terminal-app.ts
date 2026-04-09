import { useEffect, useRef, useState } from "react";
import type { AgentSession } from "../../../domain/session.ts";
import type { TerminalAppService } from "../terminal-app-service.ts";
import type { Status, TerminalOptions } from "./types.ts";
import { formatSessionListMarkdown } from "./components.tsx";

interface UseTerminalAppOptions {
  readonly app: TerminalAppService;
  readonly options: TerminalOptions;
}

export function useTerminalApp({ app, options }: UseTerminalAppOptions) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [status, setStatus] = useState<Status>("booting");
  const [thinking, setThinking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(options.sessionId);
  const [transientMessage, setTransientMessage] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null,
  );
  const activeRequestRef = useRef<AbortController | null>(null);

  const isBusy = status === "planning" || status === "executing";
  const pendingPlan = session ? app.hasPendingPlan(session) : false;
  const turns = session?.turns ?? [];

  useEffect(() => {
    app
      .loadSession()
      .then((loaded) => {
        setSession(loaded);
        setSessionId(loaded.id);
        setStatus("idle");
      })
      .catch((cause: Error) => {
        setError(cause.message);
        setStatus("error");
      });
  }, [app]);

  async function handleCommand(command: string) {
    if (session === null) return;

    if (!command.startsWith("/")) {
      setPendingUserMessage(command);
    }

    if (command === "/quit") {
      return "exit" as const;
    }

    if (command.startsWith("/resume")) {
      await handleResume(command);
      return;
    }

    if (pendingPlan && app.isConfirmation(command)) {
      await executePlan(session);
      return;
    }

    if (pendingPlan && app.isRejection(command)) {
      const next = await app.cancelLastPlan(session);
      setSession(next);
      setStatus("idle");
      setError(null);
      setPendingUserMessage(null);
      return;
    }

    if (pendingPlan) {
      const next = await app.cancelLastPlan(session);
      setSession(next);
      await submitInstruction(command, next);
      return;
    }

    await submitInstruction(command, session);
  }

  function cancelActiveRequest() {
    activeRequestRef.current?.abort();
  }

  async function handleResume(command: string) {
    setError(null);
    setThinking("");
    setPendingUserMessage(null);

    const [, rawSessionId] = command.split(/\s+/, 2);
    if (!rawSessionId) {
      const sessions = await app.listSessions();
      setTransientMessage(formatSessionListMarkdown(sessions, sessionId));
      return;
    }

    const nextSessionId = rawSessionId.trim();
    if (!nextSessionId) return;

    try {
      const resumed = await app.resumeSession(nextSessionId);
      setSession(resumed);
      setSessionId(resumed.id);
      setTransientMessage(`### Resumed chat\n\`${resumed.id}\``);
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Unknown error.");
    }
  }

  async function submitInstruction(
    instruction: string,
    currentSession: AgentSession | null = session,
  ) {
    if (currentSession === null) return;

    setStatus("planning");
    setError(null);
    setThinking("");
    setTransientMessage(null);
    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const result = await app.submitInstruction(currentSession, instruction, {
        onThinkingChunk: (chunk) => setThinking((current) => current + chunk),
        signal: controller.signal,
      });
      setSession(result.session);
      setThinking(result.response.thinking);
      setPendingUserMessage(null);
      setStatus("idle");
    } catch (cause) {
      setPendingUserMessage(null);
      if (cause instanceof Error && cause.message === "Request cancelled.") {
        setThinking("");
        setTransientMessage("Request cancelled.");
        setStatus("idle");
      } else {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Unknown error.");
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }

  async function executePlan(currentSession: AgentSession) {
    setStatus("executing");
    setError(null);
    setThinking("");
    setTransientMessage(null);
    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const result = await app.executeLastPlan(currentSession, {
        onThinkingChunk: (chunk) => setThinking((current) => current + chunk),
        signal: controller.signal,
      });
      setSession(result.session);
      setThinking("");
      setPendingUserMessage(null);
      setStatus("idle");
    } catch (cause) {
      setPendingUserMessage(null);
      if (cause instanceof Error && cause.message === "Request cancelled.") {
        setThinking("");
        setTransientMessage("Execution cancelled.");
        setStatus("idle");
      } else {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Unknown error.");
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }

  return {
    error,
    handleCommand,
    isBusy,
    pendingPlan,
    pendingUserMessage,
    session,
    sessionId,
    status,
    thinking,
    transientMessage,
    turns,
    cancelActiveRequest,
  };
}

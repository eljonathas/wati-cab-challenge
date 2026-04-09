import React, { Fragment, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { formatPlanTurnMarkdown } from "../../app/session-history.ts";
import type { SessionListItem } from "../../domain/ports/session-store.ts";
import type { AgentSession, AgentSessionTurn } from "../../domain/session.ts";
import type { TerminalAppService } from "./terminal-app-service.ts";

const theme = {
  brand: "#10a37f",
  text: "#f5f5f5",
  muted: "#9aa0a6",
  subtle: "#6b7280",
  border: "#2f3337",
  user: "#7dd3fc",
  code: "#fbbf24",
  error: "#f87171",
};

const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL = 90;

export interface TerminalOptions {
  readonly sessionId: string;
}

export interface TerminalAppProps {
  readonly app: TerminalAppService;
  readonly options: TerminalOptions;
}

type Status = "booting" | "idle" | "planning" | "executing" | "error";

export function TerminalApp({ app, options }: TerminalAppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  const [session, setSession] = useState<AgentSession | null>(null);
  const [input, setInput] = useState("");
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

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      activeRequestRef.current?.abort();
      exit();
      return;
    }

    if (key.escape && isBusy) {
      activeRequestRef.current?.abort();
      return;
    }

    if (session === null || isBusy) return;

    if (key.return) {
      const command = input.trim();
      if (!command) return;
      setInput("");
      if (!command.startsWith("/")) {
        setPendingUserMessage(command);
      }
      void handleCommand(command);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((current) => current.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && value) {
      setInput((current) => current + value);
    }
  });

  async function handleCommand(command: string) {
    if (session === null) return;

    if (command === "/quit") {
      exit();
      return;
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
    if (!nextSessionId) {
      return;
    }

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

  const turns = session?.turns ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header cols={cols} sessionId={sessionId} />

      <Box flexDirection="column" marginTop={1}>
        {turns.length === 0 && !isBusy ? <WelcomeMessage /> : null}
        {transientMessage ? (
          <AssistantMessage content={transientMessage} />
        ) : null}
        {turns.map((turn) => (
          <ConversationTurn key={turn.id} turn={turn} />
        ))}
        {pendingUserMessage ? (
          <UserMessage content={pendingUserMessage} />
        ) : null}
        {isBusy ? (
          <ThinkingMessage
            label={status === "planning" ? "Thinking" : "Executing"}
            content={thinking}
            live
          />
        ) : null}
        {error ? (
          <Box marginTop={1}>
            <Text color={theme.error}>Error: {error}</Text>
          </Box>
        ) : null}
      </Box>

      <Composer
        cols={cols}
        input={input}
        isBusy={isBusy}
        pendingPlan={pendingPlan}
      />
    </Box>
  );
}

function Header({ cols, sessionId }: { cols: number; sessionId: string }) {
  const line = "─".repeat(Math.max(cols - 2, 20));

  return (
    <Box flexDirection="column">
      <Text color={theme.border}>{line}</Text>
      <Box justifyContent="space-between">
        <Text color={theme.brand} bold>
          WATI Agent
        </Text>
        <Text color={theme.muted}>session {sessionId}</Text>
      </Box>
      <Text color={theme.border}>{line}</Text>
    </Box>
  );
}

function WelcomeMessage() {
  return (
    <AssistantMessage
      content={[
        "### WATI Agent",
        "Describe the workflow you want to automate.",
        "",
        "- Add a new contact for `6287000001111` named `Maya` with `city = Bandung`.",
        "- Assign `6289876543210` to `Sales` and add the `follow_up` tag.",
        "- Find contacts where `plan = premium` and send them the `welcome_message` template.",
      ].join("\n")}
    />
  );
}

function ConversationTurn({ turn }: { turn: AgentSessionTurn }) {
  if (turn.kind === "result") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <AssistantMessage content={turn.summary} />
      </Box>
    );
  }

  const assistantContent =
    turn.kind === "message" ? turn.content : formatPlanTurnMarkdown(turn);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <UserMessage content={turn.instruction} />
      {turn.thinking ? (
        <ThinkingMessage label="Thinking" content={turn.thinking} />
      ) : null}
      <AssistantMessage content={assistantContent} />
    </Box>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.user} bold>
        You
      </Text>
      <Box marginLeft={2}>
        <Text color={theme.text}>{content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.brand} bold>
        Assistant
      </Text>
      <Box marginLeft={2} flexDirection="column">
        <MarkdownBlock content={content} />
      </Box>
    </Box>
  );
}

function ThinkingMessage({
  label,
  content,
  live = false,
}: {
  label: string;
  content: string;
  live?: boolean;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {live ? <Spinner /> : null}
        <Text color={theme.muted} italic>
          {content.trim() ? label : `${label}…`}
        </Text>
      </Box>
      {content.trim() ? (
        <Box marginLeft={2}>
          <Text color={theme.muted} italic>
            {content.trim()}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function Spinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((current) => (current + 1) % SPINNER_CHARS.length);
    }, SPINNER_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <Text color={theme.brand} bold>
      {SPINNER_CHARS[frame]}{" "}
    </Text>
  );
}

function Composer({
  cols,
  input,
  isBusy,
  pendingPlan,
}: {
  cols: number;
  input: string;
  isBusy: boolean;
  pendingPlan: boolean;
}) {
  const line = "─".repeat(Math.max(cols - 2, 20));
  const hint = pendingPlan
    ? "yes run · no cancel · describe changes · /quit exit"
    : isBusy
      ? "esc cancel request · /quit exit"
      : "describe a workflow · /resume [uuid] · /quit exit";

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text color={theme.border}>{line}</Text>
      <Box>
        <Text color={theme.brand} bold>
          ❯{" "}
        </Text>
        {input ? (
          <Text color={theme.text}>{input}</Text>
        ) : !isBusy ? (
          <Text color={theme.subtle} italic>
            {pendingPlan
              ? "Reply yes, no, or describe what to change"
              : "Send a message"}
          </Text>
        ) : null}
      </Box>
      <Text color={theme.subtle}>{hint}</Text>
    </Box>
  );
}

function formatSessionListMarkdown(
  sessions: SessionListItem[],
  activeSessionId: string,
): string {
  if (sessions.length === 0) {
    return "### Chats\nNo saved chats yet.";
  }

  const lines = ["### Chats"];

  for (const session of sessions.slice(0, 12)) {
    const active = session.id === activeSessionId ? " _(current)_" : "";
    lines.push(
      `- \`${session.id}\`${active} · ${session.turnCount} turns · ${session.preview}`,
    );
  }

  lines.push("");
  lines.push("Use `/resume <uuid>` to reopen a chat.");
  return lines.join("\n");
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push(
        <Box key={`space-${index}`} height={1}>
          <Text> </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (
        index < lines.length &&
        !(lines[index] ?? "").trim().startsWith("```")
      ) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) index += 1;

      blocks.push(
        <CodeBlock
          key={`code-${blocks.length}`}
          language={language}
          code={stripSharedIndent(codeLines).join("\n")}
        />,
      );
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const text = trimmed.replace(/^#{1,6}\s/, "");

      blocks.push(
        <Box key={`heading-${blocks.length}`}>
          <Text color={level <= 2 ? theme.brand : theme.text} bold>
            {text}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const [, marker, text] = trimmed.match(/^(\d+\.)\s(.*)$/) ?? [];
      blocks.push(
        <Box key={`number-${blocks.length}`}>
          <Text color={theme.muted}>{marker} </Text>
          <Text color={theme.text}>
            {renderInline(text ?? "", `n-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^-\s/.test(trimmed)) {
      const text = trimmed.replace(/^-\s/, "");
      blocks.push(
        <Box key={`bullet-${blocks.length}`}>
          <Text color={theme.muted}>• </Text>
          <Text color={theme.text}>
            {renderInline(text, `b-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^>\s/.test(trimmed)) {
      const text = trimmed.replace(/^>\s/, "");
      blocks.push(
        <Box key={`quote-${blocks.length}`}>
          <Text color={theme.muted}>│ </Text>
          <Text color={theme.muted} italic>
            {renderInline(text, `q-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^_(.+)_\.?$/.test(trimmed)) {
      const text = trimmed.replace(/^_/, "").replace(/_\.?$/, "");
      blocks.push(
        <Box key={`italic-${blocks.length}`}>
          <Text color={theme.muted} italic>
            {text}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = (lines[index] ?? "").trim();
      if (!next || isMarkdownBoundary(next)) break;
      paragraph.push(next);
      index += 1;
    }

    blocks.push(
      <Box key={`paragraph-${blocks.length}`}>
        <Text color={theme.text}>
          {renderInline(paragraph.join(" "), `p-${blocks.length}`)}
        </Text>
      </Box>,
    );
  }

  return <Box flexDirection="column">{blocks}</Box>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <Box flexDirection="column" marginY={0}>
      {language ? <Text color={theme.subtle}>{language}</Text> : null}
      {code.split("\n").map((line, index) => (
        <Box key={`code-line-${index}`}>
          <Text color={theme.subtle}>│ </Text>
          <Text color={theme.code}>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];

  for (let index = 0; index < text.length; ) {
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-bold-${index}`} bold>
            {renderInline(
              text.slice(index + 2, end),
              `${keyPrefix}-b-${index}`,
            )}
          </Text>,
        );
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("`", index)) {
      const end = text.indexOf("`", index + 1);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-code-${index}`} color={theme.code}>
            {text.slice(index + 1, end)}
          </Text>,
        );
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith("*", index)) {
      const end = text.indexOf("*", index + 1);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-italic-${index}`} italic>
            {renderInline(
              text.slice(index + 1, end),
              `${keyPrefix}-i-${index}`,
            )}
          </Text>,
        );
        index = end + 1;
        continue;
      }
    }

    const next = nextMarkerIndex(text, index + 1);
    const chunkEnd = next === -1 ? text.length : next;
    const chunk = text.slice(index, chunkEnd);
    parts.push(
      <Fragment key={`${keyPrefix}-text-${index}`}>{chunk}</Fragment>,
    );
    index = chunkEnd;
  }

  return parts;
}

function nextMarkerIndex(text: string, start: number): number {
  const candidates = [
    text.indexOf("**", start),
    text.indexOf("`", start),
    text.indexOf("*", start),
  ].filter((value) => value !== -1);

  return candidates.length === 0 ? -1 : Math.min(...candidates);
}

function isMarkdownBoundary(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,6}\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^-\s/.test(line) ||
    /^>\s/.test(line)
  );
}

function stripSharedIndent(lines: string[]): string[] {
  const contentLines = lines.filter((line) => line.trim().length > 0);
  const minIndent = contentLines.reduce((current, line) => {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(current, indent);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(minIndent)) return lines;
  return lines.map((line) => line.slice(minIndent));
}

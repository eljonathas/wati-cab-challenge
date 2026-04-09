import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { formatPlanTurnMarkdown } from "../../../app/session-history.ts";
import type { SessionListItem } from "../../../domain/ports/session-store.ts";
import type { AgentSessionTurn } from "../../../domain/session.ts";
import { MarkdownBlock } from "./markdown.tsx";
import { theme, SPINNER_CHARS, SPINNER_INTERVAL } from "./types.ts";

export function Header({
  cols,
  sessionId,
}: {
  cols: number;
  sessionId: string;
}) {
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

export function WelcomeMessage() {
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

export function ConversationTurn({ turn }: { turn: AgentSessionTurn }) {
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

export function UserMessage({ content }: { content: string }) {
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

export function AssistantMessage({ content }: { content: string }) {
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

export function ThinkingMessage({
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
          {content.trim() ? label : `${label}...`}
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

export function Composer({
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
          <Box>
            <Text color={theme.text}>{input}</Text>
            <Cursor />
          </Box>
        ) : !isBusy ? (
          <Box>
            <Text color={theme.subtle} italic>
              {pendingPlan ? "Reply yes, no, or describe what to change" : ""}
            </Text>
            <Cursor color={theme.subtle} />
          </Box>
        ) : null}
      </Box>
      <Text color={theme.subtle}>{hint}</Text>
    </Box>
  );
}

function Cursor({ color = theme.text }: { color?: string }) {
  return <Text color={color}>█</Text>;
}

export function formatSessionListMarkdown(
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

import React from "react";
import { Box, Text, useApp, useStdout } from "ink";
import {
  AssistantMessage,
  Composer,
  ConversationTurn,
  ThinkingMessage,
  UserMessage,
  WelcomeMessage,
  Header,
} from "./components.tsx";
import { theme, type TerminalAppProps } from "./types.ts";
import { useTerminalApp } from "./use-terminal-app.ts";
import { useTerminalInput } from "./use-terminal-input.ts";

export type { TerminalAppProps, TerminalOptions } from "./types.ts";

export function TerminalApp({ app, options }: TerminalAppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const {
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
  } = useTerminalApp({ app, options });
  const { input } = useTerminalInput({
    disabled: status === "booting",
    hasSession: session !== null,
    isBusy,
    onCancel: cancelActiveRequest,
    onExit: exit,
    onSubmit: handleCommand,
  });

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

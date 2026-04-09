import type { TerminalAppService } from "../terminal-app-service.ts";

export const theme = {
  brand: "#10a37f",
  text: "#f5f5f5",
  muted: "#9aa0a6",
  subtle: "#6b7280",
  border: "#2f3337",
  user: "#7dd3fc",
  code: "#fbbf24",
  error: "#f87171",
};

export const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SPINNER_INTERVAL = 90;

export interface TerminalOptions {
  readonly sessionId: string;
}

export interface TerminalAppProps {
  readonly app: TerminalAppService;
  readonly options: TerminalOptions;
}

export type Status = "booting" | "idle" | "planning" | "executing" | "error";

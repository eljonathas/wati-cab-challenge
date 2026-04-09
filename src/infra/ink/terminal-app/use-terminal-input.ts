import { useState } from "react";
import { useInput } from "ink";

interface UseTerminalInputOptions {
  readonly disabled: boolean;
  readonly hasSession: boolean;
  readonly isBusy: boolean;
  readonly onCancel: () => void;
  readonly onExit: () => void;
  readonly onSubmit: (command: string) => Promise<"exit" | void> | "exit" | void;
}

export function useTerminalInput({
  disabled,
  hasSession,
  isBusy,
  onCancel,
  onExit,
  onSubmit,
}: UseTerminalInputOptions) {
  const [input, setInput] = useState("");

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      onCancel();
      onExit();
      return;
    }

    if (key.escape && isBusy) {
      onCancel();
      return;
    }

    if (disabled || !hasSession || isBusy) return;

    if (key.return) {
      const command = input.trim();
      if (!command) return;
      setInput("");
      void Promise.resolve(onSubmit(command)).then((result) => {
        if (result === "exit") {
          onExit();
        }
      });
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

  return { input };
}

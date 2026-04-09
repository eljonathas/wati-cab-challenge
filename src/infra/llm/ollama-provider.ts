import type {
  LlmProvider,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from "../../domain/ports/llm-provider.ts";

interface OllamaChunk {
  readonly message?: {
    readonly content?: string;
    readonly thinking?: string;
  };
}

export class OllamaProvider implements LlmProvider {
  constructor(
    private readonly model: string,
    private readonly think: boolean = true,
    private readonly baseUrl = "http://127.0.0.1:11434",
    private readonly timeoutMs = 90000,
  ) {}

  async generateStructuredText(
    input: StructuredGenerationInput,
  ): Promise<StructuredGenerationResult> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      this.timeoutMs,
    );
    const signal = anySignal([input.signal, timeoutController.signal]);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            ...(input.history ?? []),
            { role: "user", content: input.userPrompt },
          ],
          stream: true,
          think: this.think,
          format: "json",
          options: { temperature: 0.1 },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama request failed with status ${response.status}.`,
        );
      }

      if (!response.body) {
        throw new Error("Ollama response stream is not available.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let thinking = "";

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const payload = JSON.parse(trimmed) as OllamaChunk;
          const thinkingChunk = payload.message?.thinking ?? "";
          const contentChunk = payload.message?.content ?? "";

          if (thinkingChunk) {
            thinking += thinkingChunk;
            input.callbacks?.onThinkingChunk?.(thinkingChunk);
          }

          if (contentChunk) {
            content += contentChunk;
          }
        }
      }

      if (!content.trim()) {
        throw new Error("Ollama returned an empty response.");
      }

      return { content, thinking };
    } catch (cause) {
      if (isAbortError(cause)) {
        if (input.signal?.aborted) {
          throw new Error("Request cancelled.");
        }
        throw new Error(`Ollama request timed out after ${this.timeoutMs}ms.`);
      }
      throw cause;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function anySignal(
  signals: Array<AbortSignal | undefined>,
): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal =>
    Boolean(signal),
  );
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.some((signal) => signal.aborted)) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of activeSignals) {
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException
    ? cause.name === "AbortError"
    : cause instanceof Error && cause.name === "AbortError";
}

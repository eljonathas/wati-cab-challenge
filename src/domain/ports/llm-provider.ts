import type { SessionMessage } from "../session.ts";

export interface LlmStreamCallbacks {
  onThinkingChunk?(chunk: string): void;
}

export interface StructuredGenerationInput {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly history?: SessionMessage[];
  readonly callbacks?: LlmStreamCallbacks;
  readonly signal?: AbortSignal;
}

export interface StructuredGenerationResult {
  readonly content: string;
  readonly thinking: string;
}

export interface LlmProvider {
  generateStructuredText(input: StructuredGenerationInput): Promise<StructuredGenerationResult>;
}

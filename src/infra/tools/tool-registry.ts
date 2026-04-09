import type { Json } from "../../domain/agent.ts";
import type {
  ToolDefinition,
  ToolExecutor,
} from "../../domain/ports/tool-catalog.ts";
import { getRegisteredTools } from "./tool.decorator.ts";

type Handler = (input: Record<string, Json>) => Promise<unknown>;

export class ToolRegistry implements ToolExecutor {
  private readonly tools = new Map<
    string,
    { definition: ToolDefinition; handler: Handler }
  >();

  register(instance: object): void {
    for (const metadata of getRegisteredTools(
      Object.getPrototypeOf(instance),
    )) {
      const handler = Reflect.get(instance, metadata.methodName) as
        | Handler
        | undefined;

      if (!handler) {
        throw new Error(`Missing handler for tool ${metadata.key}`);
      }

      this.tools.set(metadata.key, {
        definition: {
          key: metadata.key,
          description: metadata.description,
          parameters: metadata.parameters,
        },
        handler: handler.bind(instance),
      });
    }
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((entry) => entry.definition);
  }

  async execute(key: string, input: Record<string, Json>): Promise<unknown> {
    const entry = this.tools.get(key);
    if (!entry) {
      throw new Error(`Tool not registered: ${key}`);
    }

    return entry.handler(input);
  }
}

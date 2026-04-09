import type { ToolParamSchema } from "../../domain/ports/tool-catalog.ts";

export interface RegisteredToolMetadata {
  readonly key: string;
  readonly description: string;
  readonly parameters: ToolParamSchema[];
  readonly methodName: string;
}

const TOOL_METADATA = Symbol("tool_metadata");

export function Tool(
  key: string,
  description: string,
  parameters: ToolParamSchema[] = [],
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): void {
    if (!descriptor.value) {
      throw new Error(
        `Tool decorator can only be used on methods: ${propertyKey}`,
      );
    }
    const current = Reflect.get(target, TOOL_METADATA) as
      | RegisteredToolMetadata[]
      | undefined;
    const next = current ? [...current] : [];
    next.push({ key, description, parameters, methodName: propertyKey });
    Reflect.set(target, TOOL_METADATA, next);
  };
}

export function getRegisteredTools(target: object): RegisteredToolMetadata[] {
  return (
    (Reflect.get(target, TOOL_METADATA) as
      | RegisteredToolMetadata[]
      | undefined) ?? []
  );
}

import { mkdir, readdir } from "node:fs/promises";
import type {
  SessionListItem,
  SessionStore,
} from "../../domain/ports/session-store.ts";
import type { AgentSession } from "../../domain/session.ts";

export class FileSessionStore implements SessionStore {
  constructor(private readonly baseDir = ".sessions") {}

  async load(sessionId: string): Promise<AgentSession> {
    const file = Bun.file(this.pathFor(sessionId));
    if (!(await file.exists())) {
      return { id: sessionId, turns: [] };
    }
    return (await file.json()) as AgentSession;
  }

  async save(session: AgentSession): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await Bun.write(this.pathFor(session.id), JSON.stringify(session, null, 2));
  }

  async list(): Promise<SessionListItem[]> {
    await mkdir(this.baseDir, { recursive: true });
    const entries = await readdir(this.baseDir, { withFileTypes: true });

    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const id = entry.name.replace(/\.json$/, "");
          const session = await this.load(id);
          const lastTurn = session.turns.at(-1);

          return {
            id,
            updatedAt: lastTurn?.createdAt ?? "",
            turnCount: session.turns.length,
            preview: lastTurn && "instruction" in lastTurn ? lastTurn.instruction : "Empty session",
          } satisfies SessionListItem;
        }),
    );

    return sessions.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  private pathFor(sessionId: string): string {
    return `${this.baseDir}/${sessionId}.json`;
  }
}

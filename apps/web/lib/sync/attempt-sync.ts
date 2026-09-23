import type { components } from "@inorganic/contracts";
import { apiClient, unwrapApiResponse } from "../api/client";
import { attemptEventSchema } from "../browser-progress-store";
import { type ApiAttempt, mapAttempt } from "./attempt-mapper";
import { acknowledgeAttempts, pendingAttempts, pullCursor, savePulledAttempts } from "./sync-store";

type BatchResponse = components["schemas"]["BatchResponse"];
type AttemptPage = components["schemas"]["AttemptPage"];

export interface SyncTransport {
  upload(events: ApiAttempt[]): Promise<BatchResponse>;
  list(cursor: string | null): Promise<AttemptPage>;
}

const apiTransport: SyncTransport = {
  async upload(events) {
    return unwrapApiResponse(
      await apiClient.POST("/api/v1/me/attempt-events/batch", { body: { events } }),
    );
  },
  async list(cursor) {
    return unwrapApiResponse(
      await apiClient.GET("/api/v1/me/attempt-events", {
        params: { query: { cursor, limit: 500 } },
        cache: "no-store",
      }),
    );
  },
};

export async function runAttemptSync(
  indexedDb: IDBFactory,
  userId: string,
  transport: SyncTransport = apiTransport,
): Promise<void> {
  for (;;) {
    const pending = await pendingAttempts(indexedDb, userId, 100);
    if (pending.length === 0) break;
    const response = await transport.upload(pending.map(mapAttempt));
    const acknowledged = new Set([...response.accepted, ...response.duplicates]);
    if (pending.some(({ id }) => !acknowledged.has(id)))
      throw new Error("Server nepotvrdil všechny odeslané pokusy.");
    await acknowledgeAttempts(indexedDb, userId, [...acknowledged]);
  }

  let cursor = await pullCursor(indexedDb, userId);
  for (;;) {
    const page = await transport.list(cursor);
    if (page.items.length === 0) break;
    if (page.nextCursor === null || page.nextCursor === cursor)
      throw new Error("Server nevrátil platný pokračovací kurzor.");
    const attempts = page.items.map(({ event }) => attemptEventSchema.parse(event));
    await savePulledAttempts(indexedDb, userId, attempts, page.nextCursor);
    cursor = page.nextCursor;
  }
}

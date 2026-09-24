import type { components } from "@inorganic/contracts";
import { apiClient, unwrapApiResponse } from "../api/client";
import { type AttemptEvent, attemptEventSchema } from "../browser-progress-store";
import { type ApiAttempt, mapAttempt } from "./attempt-mapper";
import {
  acknowledgeAttempts,
  pendingAttempts,
  pullCursor,
  type QuarantineInput,
  quarantineRejectedAttempts,
  restoreLegacyQuotaAttempts,
  savePulledAttempts,
  setUploadRetryAt,
  uploadRetryAt,
} from "./sync-store";

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
  await restoreLegacyQuotaAttempts(indexedDb, userId);
  const retryAt = await uploadRetryAt(indexedDb, userId);
  if (retryAt !== null && Date.now() >= retryAt) {
    await setUploadRetryAt(indexedDb, userId, null);
  }
  for (; retryAt === null || Date.now() >= retryAt; ) {
    const pending = await pendingAttempts(indexedDb, userId, 100);
    if (pending.length === 0) break;
    const response = await transport.upload(pending.map(mapAttempt));
    const acknowledged = new Set([...response.accepted, ...response.duplicates]);
    const rejectedByIndex = new Map(
      response.rejected.map((rejection) => [rejection.index, rejection]),
    );
    if (rejectedByIndex.size !== response.rejected.length) {
      throw new Error("Server returned duplicate rejection indexes.");
    }
    const quarantine = [];
    const accepted: string[] = [];
    let quotaExceeded = false;
    for (const [index, attempt] of pending.entries()) {
      const rejected = rejectedByIndex.get(index);
      if (rejected) {
        if (rejected.eventId !== null && rejected.eventId !== attempt.id) {
          throw new Error("Server vrátil odmítnutí pro jiný pokus.");
        }
        if (rejected.code === "quota_exceeded") {
          quotaExceeded = true;
          continue;
        }
        quarantine.push({
          id: attempt.id,
          eventId: attempt.id,
          outboxKey: attempt.id,
          raw: attempt,
          source: "server" as const,
          reason: rejectionReason(rejected.code),
        });
      } else if (acknowledged.has(attempt.id)) {
        accepted.push(attempt.id);
      } else {
        throw new Error("Server nevrátil výsledek pro všechny odeslané pokusy.");
      }
    }
    if (rejectedByIndex.size + accepted.length !== pending.length) {
      throw new Error("Server vrátil duplicitní nebo neplatný výsledek pokusu.");
    }
    if (quarantine.length > 0) await quarantineRejectedAttempts(indexedDb, userId, quarantine);
    if (accepted.length > 0) await acknowledgeAttempts(indexedDb, userId, accepted);
    if (quotaExceeded) {
      const now = new Date();
      await setUploadRetryAt(
        indexedDb,
        userId,
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );
      break;
    }
  }

  let cursor = await pullCursor(indexedDb, userId);
  for (;;) {
    const page = await transport.list(cursor);
    if (page.items.length === 0) break;
    if (page.nextCursor === null || page.nextCursor === cursor)
      throw new Error("Server nevrátil platný pokračovací kurzor.");
    const attempts: AttemptEvent[] = [];
    const rejected: QuarantineInput[] = [];
    for (const item of page.items) {
      try {
        attempts.push(attemptEventSchema.parse(item.event));
      } catch {
        const rawId =
          typeof item.event === "object" && item.event !== null && "id" in item.event
            ? item.event.id
            : null;
        const eventId = typeof rawId === "string" ? rawId : null;
        rejected.push({
          id: eventId ?? `server-unreadable-${item.serverSeq}`,
          eventId,
          raw: item,
          source: "server" as const,
          reason: "Server returned an attempt format this app version cannot read.",
        });
      }
    }
    if (rejected.length > 0) await quarantineRejectedAttempts(indexedDb, userId, rejected);
    await savePulledAttempts(indexedDb, userId, attempts, page.nextCursor);
    cursor = page.nextCursor;
  }
}

function rejectionReason(code: string): string {
  switch (code) {
    case "validation_error":
      return "Server odmítl pokus: jeho formát už není podporovaný.";
    case "idempotency_conflict":
      return "Server odmítl pokus: jeho ID už bylo použito s jiným obsahem.";
    default:
      return "Server odmítl pokus z neznámého důvodu.";
  }
}

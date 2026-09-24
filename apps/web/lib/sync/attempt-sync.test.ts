import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { type AttemptEvent, createBrowserProgressStore } from "../browser-progress-store";
import { runAttemptSync, type SyncTransport } from "./attempt-sync";
import { pendingCount, pullCursor } from "./sync-store";

const userId = "44444444-4444-4444-8444-444444444444";
const event: AttemptEvent = {
  id: "attempt.sync",
  questionId: "element.h",
  contentVersion: "v1",
  occurredAt: "2026-09-23T10:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "element-name",
  direction: "symbol-to-name",
  matchPolicy: "diacritics-tolerant",
};
let database: IDBFactory;

beforeEach(() => {
  database = new IDBFactory();
});

describe("attempt sync", () => {
  it("uploads pending attempts, accepts duplicates, and pulls events without requeueing", async () => {
    await createBrowserProgressStore(database, userId).appendAttempt(event);
    const remote: AttemptEvent = { ...event, id: "attempt.other-device" };
    const upload = vi
      .fn<SyncTransport["upload"]>()
      .mockResolvedValue({ accepted: [], duplicates: [event.id], rejected: [] });
    const list = vi
      .fn<SyncTransport["list"]>()
      .mockResolvedValueOnce({
        items: [{ event: remote, serverSeq: 2, receivedAt: "2026-09-23T11:00:00.000Z" }],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    await runAttemptSync(database, userId, { upload, list });
    expect(upload).toHaveBeenCalledWith([event]);
    expect(list).toHaveBeenNthCalledWith(2, "cursor-2");
    expect(await pendingCount(database, userId)).toBe(0);
    expect(await pullCursor(database, userId)).toBe("cursor-2");
    expect(await createBrowserProgressStore(database, userId).listAttempts()).toEqual([
      remote,
      event,
    ]);
  });

  it.each([new ApiError(409, "idempotency_conflict", "Conflict"), new TypeError("Network failed")])(
    "keeps the outbox after upload failure %s",
    async (failure) => {
      await createBrowserProgressStore(database, userId).appendAttempt(event);
      const transport: SyncTransport = {
        upload: vi.fn().mockRejectedValue(failure),
        list: vi.fn(),
      };
      await expect(runAttemptSync(database, userId, transport)).rejects.toThrow();
      expect(await pendingCount(database, userId)).toBe(1);
      expect(transport.list).not.toHaveBeenCalled();
    },
  );
});

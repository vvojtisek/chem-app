import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCOUNT_MARKER_KEY,
  clearAccountMarker,
  readAccountMarker,
  saveAccountMarker,
} from "./account-marker";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "student",
  role: "user",
  email: null,
  displayName: null,
  progressGeneration: "00000000-0000-0000-0000-000000000000",
} as const;

beforeEach(() => localStorage.clear());

describe("account marker", () => {
  it("stores identity without credentials and rejects malformed data", () => {
    saveAccountMarker(user);
    expect(readAccountMarker()).toMatchObject({
      userId: user.id,
      username: user.username,
      role: "user",
    });
    expect(localStorage.getItem(ACCOUNT_MARKER_KEY)).not.toContain("token");
    localStorage.setItem(ACCOUNT_MARKER_KEY, JSON.stringify({ schemaVersion: 1, userId: "bad" }));
    expect(readAccountMarker()).toBeNull();
    clearAccountMarker();
    expect(readAccountMarker()).toBeNull();
  });
});

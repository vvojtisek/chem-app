import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientId } from "./client-id";

afterEach(() => vi.unstubAllGlobals());

describe("createClientId", () => {
  it("uses randomUUID when the browser exposes it", () => {
    const randomUUID = vi.fn(() => "native-id");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createClientId()).toBe("native-id");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates a UUID-shaped ID when randomUUID is unavailable on an HTTP origin", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(createClientId()).toBe("00000000-0000-4000-8000-000000000000");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});

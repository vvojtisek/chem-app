import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchServedVersion, isNewerVersion } from "./app-version";

describe("isNewerVersion", () => {
  it.each([
    ["1.1.9", "1.1.8"],
    ["1.2.0", "1.1.8"],
    ["2.0.0", "1.9.9"],
    ["1.10.0", "1.9.0"],
  ])("treats %s as newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(true);
  });

  it.each([
    ["1.1.8", "1.1.8"],
    ["1.1.7", "1.1.8"],
    ["1.9.0", "1.10.0"],
    ["v1.2.0", "1.1.8"],
    ["1.2", "1.1.8"],
    ["1.2.0-rc.1", "1.1.8"],
    ["1.2.0", "unknown"],
  ])("does not treat %s as newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(false);
  });
});

describe("fetchServedVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondWith(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads the version the server is running without using a cache", async () => {
    const fetchMock = respondWith(Response.json({ version: "1.9.0" }));

    await expect(fetchServedVersion()).resolves.toBe("1.9.0");
    expect(fetchMock).toHaveBeenCalledWith(
      "/app-version",
      expect.objectContaining({ cache: "no-store", redirect: "manual" }),
    );
  });

  it.each([
    ["an error status", new Response("", { status: 502 })],
    ["a malformed version", Response.json({ version: "latest" })],
    ["a missing version", Response.json({})],
  ])("returns null for %s", async (_case, response) => {
    respondWith(response);

    await expect(fetchServedVersion()).resolves.toBeNull();
  });
});

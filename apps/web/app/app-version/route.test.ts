import { describe, expect, it } from "vitest";

import { APP_VERSION } from "@/lib/app-version";
import { GET } from "./route";

describe("GET /app-version", () => {
  it("reports the running build without letting it be cached", async () => {
    const response = GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ version: APP_VERSION });
  });
});

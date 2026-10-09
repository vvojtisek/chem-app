// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

function navigate(path: string, cookie?: string) {
  return proxy(
    new NextRequest(`https://chemie.example${path}`, cookie ? { headers: { cookie } } : undefined),
  );
}

describe("proxy", () => {
  it("serves the privacy notice without a session so it can be read before first sign-in", () => {
    const response = navigate("/soukromi");

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects other application routes to login without a session", () => {
    const response = navigate("/procvicovani?mode=a");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://chemie.example/login?next=%2Fprocvicovani%3Fmode%3Da",
    );
  });

  it("lets application routes through when the session cookie is present", () => {
    const response = navigate("/procvicovani", "__Host-inorganic_session=opaque");

    expect(response.headers.get("location")).toBeNull();
  });
});

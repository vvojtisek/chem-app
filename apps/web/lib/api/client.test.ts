import { describe, expect, it } from "vitest";
import { ApiError, getCsrfToken, unwrapApiResponse } from "./client";

describe("API client", () => {
  it("reads only the named CSRF cookie", () => {
    expect(getCsrfToken("other=wrong; __Host-inorganic_csrf=abc%2F123; suffix=ok")).toBe("abc/123");
    expect(getCsrfToken("other=wrong")).toBeNull();
  });

  it("turns the error envelope into a typed error", () => {
    expect(() =>
      unwrapApiResponse({
        response: new Response(null, { status: 403 }),
        error: { error: { code: "forbidden", message: "Access denied." } },
      }),
    ).toThrow(ApiError);
    try {
      unwrapApiResponse({
        response: new Response(null, { status: 409 }),
        error: { error: { code: "idempotency_conflict", message: "Conflict" } },
      });
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: "idempotency_conflict" });
    }
  });
});

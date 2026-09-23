import type { components, paths } from "@inorganic/contracts";
import createClient from "openapi-fetch";
import { z } from "zod";

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const csrfCookieName = "__Host-inorganic_csrf";

export type CurrentUser = components["schemas"]["MeResponse"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getCsrfToken(cookie = document.cookie): string | null {
  const prefix = `${csrfCookieName}=`;
  const part = cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return null;
  }
}

export const apiClient = createClient<paths>({ credentials: "same-origin" });

apiClient.use({
  onRequest({ request }) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const token = getCsrfToken();
      if (token) request.headers.set("X-CSRF-Token", token);
    }
    return request;
  },
});

export function unwrapApiResponse<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  if (result.response.ok) throw new Error("Server vrátil prázdnou odpověď.");
  throw parseApiError(result.response.status, result.error);
}

function parseApiError(status: number, error: unknown): ApiError {
  const parsed = errorSchema.safeParse(error);
  return new ApiError(
    status,
    parsed.success ? parsed.data.error.code : "unknown_error",
    parsed.success ? parsed.data.error.message : "Požadavek se nepodařilo dokončit.",
  );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return unwrapApiResponse(await apiClient.GET("/api/v1/auth/me", { cache: "no-store" }));
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  return unwrapApiResponse(
    await apiClient.POST("/api/v1/auth/login", { body: { username, password } }),
  );
}

export async function logout(): Promise<void> {
  const result = await apiClient.POST("/api/v1/auth/logout");
  if (!result.response.ok) throw parseApiError(result.response.status, result.error);
}

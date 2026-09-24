import type { components, paths } from "@inorganic/contracts";
import createClient from "openapi-fetch";
import { z } from "zod";

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "__Host-inorganic_csrf";

export type CurrentUser = components["schemas"]["MeResponse"];
export type UserProfile = components["schemas"]["ProfileResponse"];
export type UserProgression = components["schemas"]["Progression"];

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

export async function login(identifier: string, password: string): Promise<CurrentUser> {
  const body = identifier.includes("@")
    ? { email: identifier, password }
    : { username: identifier, password };
  return unwrapApiResponse(await apiClient.POST("/api/v1/auth/login", { body }));
}

async function unwrapEmptyResponse(result: { response: Response; error?: unknown }): Promise<void> {
  if (!result.response.ok) throw parseApiError(result.response.status, result.error);
}

export async function registerAccount(email: string): Promise<void> {
  await unwrapEmptyResponse(await apiClient.POST("/api/v1/auth/register", { body: { email } }));
}

export async function verifyEmail(token: string, newPassword: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/auth/verify-email", { body: { token, newPassword } }),
  );
}

export async function requestEmailVerification(email: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/auth/verification/request", { body: { email } }),
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/auth/password-reset/request", { body: { email } }),
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/auth/password-reset/confirm", { body: { token, newPassword } }),
  );
}

export async function guestLogin(): Promise<CurrentUser> {
  return unwrapApiResponse(await apiClient.POST("/api/v1/auth/guest"));
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/me/password", { body: { currentPassword, newPassword } }),
  );
}

export async function updateMyProfile(displayName: string): Promise<CurrentUser> {
  const result = await apiClient.PATCH("/api/v1/me/profile", { body: { displayName } });
  if (!result.response.ok) throw parseApiError(result.response.status, result.error);
  return getCurrentUser();
}

export async function updateAdminProfile(
  userId: string,
  body: {
    displayName?: string | null;
    email?: string | null;
    role?: "admin" | "user" | "tester";
    isActive?: boolean;
  },
): Promise<void> {
  const result = await apiClient.PATCH("/api/v1/admin/users/{user_id}/profile", {
    params: { path: { user_id: userId } },
    body,
  });
  await unwrapEmptyResponse(result);
}

export async function adminSetPassword(userId: string, newPassword: string): Promise<void> {
  await unwrapEmptyResponse(
    await apiClient.POST("/api/v1/admin/users/{user_id}/password", {
      params: { path: { user_id: userId } },
      body: { newPassword },
    }),
  );
}

export async function logout(): Promise<void> {
  const result = await apiClient.POST("/api/v1/auth/logout");
  if (!result.response.ok) throw parseApiError(result.response.status, result.error);
}

export async function getMyProfile(): Promise<UserProfile> {
  return unwrapApiResponse(await apiClient.GET("/api/v1/me/profile", { cache: "no-store" }));
}

export async function getAdminProfile(userId: string): Promise<UserProfile> {
  return unwrapApiResponse(
    await apiClient.GET("/api/v1/admin/users/{user_id}/profile", {
      params: { path: { user_id: userId } },
      cache: "no-store",
    }),
  );
}

export async function getMyProgression(): Promise<UserProgression> {
  return unwrapApiResponse(await apiClient.GET("/api/v1/me/progression", { cache: "no-store" }));
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { PageHeader } from "@/components/page-header";
import {
  adminSetPassword,
  ApiError,
  apiClient,
  getAdminProfile,
  updateAdminProfile,
  unwrapApiResponse,
} from "@/lib/api/client";
import { clearAccountMarker } from "@/lib/auth/account-marker";
import { queryKeys } from "@/lib/query-keys";

export default function AdminPage() {
  const account = useAccount();
  const allowed = account?.role === "admin";
  const [selectedId, setSelectedId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user" | "tester">("user");
  const [isActive, setIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();
  const users = useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: async () =>
      unwrapApiResponse(
        await apiClient.GET("/api/v1/admin/users", {
          params: { query: { limit: 100 } },
          cache: "no-store",
        }),
      ),
    enabled: allowed,
  });
  const stats = useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: async () =>
      unwrapApiResponse(await apiClient.GET("/api/v1/admin/stats", { cache: "no-store" })),
    enabled: allowed,
  });
  const attempts = useQuery({
    queryKey: queryKeys.admin.attempts(selectedId),
    queryFn: async () =>
      unwrapApiResponse(
        await apiClient.GET("/api/v1/admin/users/{user_id}/attempt-events", {
          params: { path: { user_id: selectedId }, query: { limit: 100 } },
          cache: "no-store",
        }),
      ),
    enabled: allowed && selectedId.length > 0,
  });
  const profile = useQuery({
    queryKey: queryKeys.admin.profile(selectedId),
    queryFn: () => getAdminProfile(selectedId),
    enabled: allowed && selectedId.length > 0,
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setEmail(profile.data.email ?? "");
    setRole(
      profile.data.role === "admin" || profile.data.role === "tester" ? profile.data.role : "user",
    );
    setIsActive(profile.data.isActive);
  }, [profile.data]);

  if (!allowed)
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 lg:py-10">
        <PageHeader description="Správa je dostupná pouze správci." title="Přístup odepřen" />
      </main>
    );

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateAdminProfile(selectedId, {
        displayName: displayName.trim() || null,
        email: email.trim() || null,
        role,
        isActive,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.profile(selectedId) }),
      ]);
      setMessage("Účet byl aktualizován.");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "last_admin"
          ? "Posledního aktivního správce nelze deaktivovat ani změnit jeho roli."
          : cause instanceof ApiError && cause.code === "email_taken"
            ? "Tato e-mailová adresa už patří jinému účtu."
            : "Účet se nepodařilo aktualizovat.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== passwordConfirmation) {
      setError("Zadaná hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      await adminSetPassword(selectedId, newPassword);
      if (selectedId === account?.id) {
        clearAccountMarker();
        queryClient.clear();
        router.replace("/login?passwordChanged=1");
        router.refresh();
        return;
      }
      setNewPassword("");
      setPasswordConfirmation("");
      setMessage("Heslo bylo změněno a předchozí relace účtu byly ukončeny.");
    } catch {
      setError("Heslo účtu se nepodařilo změnit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        description="Testovací účty jsou ze souhrnných statistik vyloučeny."
        title="Správa účtů"
      />
      {stats.data ? (
        <section aria-label="Souhrnné statistiky" className="rounded-xl border p-4">
          <p>Celkem pokusů: {stats.data.totalAttempts}</p>
          <p>Správně: {stats.data.correctAttempts}</p>
        </section>
      ) : (
        <p role="status" className="mt-4">
          {stats.isError ? "Statistiky se nepodařilo načíst." : "Načítám statistiky…"}
        </p>
      )}
      <h2 className="mt-8 text-xl font-semibold">Účty</h2>
      {users.data ? (
        <ul className="mt-3 divide-y rounded-xl border bg-surface">
          {users.data.items.map((user) => (
            <li className="flex flex-wrap items-center justify-between gap-3 p-3" key={user.id}>
              <span>
                {user.displayName || user.username} · {user.role}
                {user.isActive ? "" : " · neaktivní"}
                {user.email ? <small className="block text-ink-2">{user.email}</small> : null}
                <small className="block text-ink-2">
                  Poslední přihlášení:{" "}
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString("cs-CZ")
                    : "dosud žádné"}
                </small>
              </span>
              <button
                className="min-h-11 rounded-xl border px-3"
                onClick={() => {
                  setSelectedId(user.id);
                  setMessage("");
                  setError("");
                }}
                type="button"
              >
                Spravovat účet
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-4">
          {users.isError ? "Účty se nepodařilo načíst." : "Načítám účty…"}
        </p>
      )}

      {profile.data ? (
        <section
          aria-labelledby="selected-account"
          className="mt-8 rounded-2xl border bg-surface p-5"
        >
          <h2 className="text-xl font-semibold" id="selected-account">
            Účet: {profile.data.username}
          </h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void saveProfile(event)}
          >
            <label className="grid gap-1 font-medium">
              Zobrazované jméno
              <input
                className="min-h-11 rounded-xl border px-3"
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </label>
            <label className="grid gap-1 font-medium">
              E-mail
              <input
                className="min-h-11 rounded-xl border px-3"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <span className="text-xs text-ink-2">
                Upravená adresa bude označena jako potvrzená správcem.
              </span>
            </label>
            <label className="grid gap-1 font-medium">
              Role
              <select
                className="min-h-11 rounded-xl border bg-surface px-3"
                onChange={(event) => setRole(event.target.value as "admin" | "user" | "tester")}
                value={role}
              >
                <option value="user">Uživatel</option>
                <option value="admin">Správce</option>
                <option value="tester">Tester</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 font-medium">
              <input
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                type="checkbox"
              />
              Aktivní účet
            </label>
            <button
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
              disabled={busy}
              type="submit"
            >
              Uložit účet
            </button>
          </form>

          <form
            className="mt-8 grid gap-4 border-t pt-5 sm:max-w-md"
            onSubmit={(event) => void setUserPassword(event)}
          >
            <h3 className="text-lg font-semibold">Nastavit nové heslo</h3>
            <label className="grid gap-1 font-medium">
              Nové heslo (alespoň 12 znaků)
              <input
                autoComplete="new-password"
                className="min-h-11 rounded-xl border px-3"
                maxLength={1024}
                minLength={12}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="grid gap-1 font-medium">
              Potvrdit nové heslo
              <input
                autoComplete="new-password"
                className="min-h-11 rounded-xl border px-3"
                maxLength={1024}
                minLength={12}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
                type="password"
                value={passwordConfirmation}
              />
            </label>
            <button
              className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              Nastavit heslo a ukončit relace
            </button>
          </form>
          {message ? (
            <p className="mt-4 text-good" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-bad" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : selectedId ? (
        <p className="mt-5" role="status">
          {profile.isError ? "Profil účtu se nepodařilo načíst." : "Načítám účet…"}
        </p>
      ) : null}

      {selectedId ? (
        <section aria-label="Historie pokusů" className="mt-8">
          <h2 className="text-xl font-semibold">Historie pokusů</h2>
          {attempts.data ? (
            <ul className="mt-3 divide-y rounded-xl border bg-surface">
              {attempts.data.items.map(({ event }) => (
                <li className="p-3" key={event.id}>
                  {event.mode} · {event.questionId} · {event.isCorrect ? "správně" : "chybně"}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="mt-3">
              {attempts.isError ? "Pokusy se nepodařilo načíst." : "Načítám pokusy…"}
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { apiClient, unwrapApiResponse } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export default function AdminPage() {
  const account = useAccount();
  const [selectedId, setSelectedId] = useState("");
  const allowed = account?.role === "admin";
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

  if (!allowed)
    return (
      <main className="mx-auto max-w-2xl p-5">
        <h1 className="text-2xl font-semibold">Přístup odepřen</h1>
        <p>Správa je dostupná pouze správci.</p>
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <h1 className="text-3xl font-semibold">Správa účtů</h1>
      <p className="mt-2 text-slate-600">Testovací účty jsou ze souhrnných statistik vyloučeny.</p>
      {stats.data ? (
        <section aria-label="Souhrnné statistiky" className="mt-6 rounded-xl border p-4">
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
        <ul className="mt-3 divide-y rounded-xl border">
          {users.data.items.map((user) => (
            <li className="flex flex-wrap items-center justify-between gap-3 p-3" key={user.id}>
              <span>
                {user.username} · {user.role}
                {user.isActive ? "" : " · neaktivní"}
                <small className="block text-slate-600">
                  Poslední přihlášení:{" "}
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString("cs-CZ")
                    : "dosud žádné"}
                </small>
              </span>
              <button
                className="min-h-11 rounded-xl border px-3"
                onClick={() => setSelectedId(user.id)}
                type="button"
              >
                Zobrazit pokusy
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-4">
          {users.isError ? "Účty se nepodařilo načíst." : "Načítám účty…"}
        </p>
      )}
      {selectedId ? (
        <section aria-label="Historie pokusů" className="mt-8">
          <h2 className="text-xl font-semibold">Historie účtu</h2>
          {attempts.data ? (
            <ul className="mt-3 divide-y rounded-xl border">
              {attempts.data.items.map(({ event }) => (
                <li className="p-3" key={event.id}>
                  {event.mode} · {event.questionId} · {event.isCorrect ? "správně" : "chybně"}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">
              {attempts.isError ? "Pokusy se nepodařilo načíst." : "Načítám pokusy…"}
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}

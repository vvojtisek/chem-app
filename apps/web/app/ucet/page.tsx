"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { PageHeader } from "@/components/page-header";
import { useSync } from "@/components/sync-provider";
import {
  ApiError,
  changePassword,
  getMyProfile,
  getMyProgression,
  logout,
  updateMyProfile,
} from "@/lib/api/client";
import { clearAccountMarker } from "@/lib/auth/account-marker";
import { resetLearningDatabase } from "@/lib/browser-learning-database";
import { queryKeys } from "@/lib/query-keys";
import { pendingCount } from "@/lib/sync/sync-store";

export default function AccountPage() {
  const account = useAccount();
  const { canManageProfile, canViewProgress } = useCapabilities();
  const sync = useSync();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isGuest = !canManageProfile;
  const profile = useQuery({
    queryKey: queryKeys.me.profile,
    queryFn: getMyProfile,
    enabled: Boolean(account && !isGuest),
  });
  const progression = useQuery({
    queryKey: queryKeys.me.stats,
    queryFn: getMyProgression,
    enabled: canViewProgress,
  });
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile.data?.displayName ?? "");
  }, [profile.data?.displayName]);

  if (!account) return null;

  async function signOut(clearData: boolean) {
    if (!account) return;
    setBusy(true);
    setError("");
    try {
      if (clearData) {
        const pending = await pendingCount(indexedDB, account.id);
        const confirmed = window.confirm(
          pending > 0
            ? `Na odeslání čeká ${pending} pokusů. Jejich smazání může být nevratné. Opravdu smazat data tohoto účtu ze zařízení?`
            : "Opravdu smazat lokální karty, rozpracovaná cvičení a pokusy tohoto účtu ze zařízení?",
        );
        if (!confirmed) return;
        await resetLearningDatabase(indexedDB, account.id);
      }
      await logout();
      clearAccountMarker();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Odhlášení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateMyProfile(displayName.trim());
      await queryClient.invalidateQueries({ queryKey: queryKeys.me.profile });
      setMessage("Profil byl uložen.");
    } catch {
      setError("Profil se nepodařilo uložit.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== passwordConfirmation) {
      setError("Nová hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      clearAccountMarker();
      queryClient.clear();
      router.replace("/login?passwordChanged=1");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "invalid_credentials"
          ? "Současné heslo není správné."
          : "Heslo se nepodařilo změnit.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (isGuest) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 lg:py-10">
        <PageHeader
          description="Prohlížíte aplikaci pouze pro čtení. Úpravy karet, pokusy ani nastavení se neukládají."
          title="Hostovský přístup"
        />
        <button
          className="min-h-11 rounded-xl border px-4 font-semibold"
          disabled={busy}
          onClick={() => void signOut(false)}
          type="button"
        >
          Ukončit hostovský přístup
        </button>
        <p aria-live="polite" className="mt-3 text-bad" role={error ? "alert" : undefined}>
          {error}
        </p>
      </main>
    );
  }

  if (!account) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader title="Profil" />
      {profile.data ? (
        <section aria-label="Údaje profilu" className="rounded-2xl border bg-surface p-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-2">Přihlašovací jméno</dt>
              <dd className="font-medium">{profile.data.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">E-mail</dt>
              <dd className="font-medium">
                {profile.data.email ?? "Není nastaven"}
                {profile.data.email && !profile.data.emailVerified ? " · nepotvrzený" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">Role</dt>
              <dd className="font-medium">
                {account.role === "admin"
                  ? "Správce"
                  : account.role === "tester"
                    ? "Testovací účet"
                    : "Uživatel"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">Synchronizace</dt>
              <dd className="font-medium">{sync.label}</dd>
            </div>
          </dl>
          <form
            className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => void saveProfile(event)}
          >
            <label className="grid gap-1 font-medium">
              Zobrazované jméno
              <input
                autoComplete="nickname"
                className="min-h-11 rounded-xl border border-line-strong px-3"
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
            <button
              className="min-h-11 self-end rounded-xl border px-4 font-semibold"
              disabled={busy}
              type="submit"
            >
              Uložit profil
            </button>
          </form>
          {profile.isError ? <p role="alert">Údaje profilu se nepodařilo načíst.</p> : null}
        </section>
      ) : (
        <p role="status">{profile.isError ? "Profil se nepodařilo načíst." : "Načítám profil…"}</p>
      )}

      {account.role !== "tester" ? (
        <ProgressionPanel progression={progression.data} isLoading={progression.isPending} />
      ) : null}

      <section
        aria-labelledby="password-heading"
        className="mt-6 rounded-2xl border bg-surface p-5"
      >
        <h2 className="text-xl font-semibold" id="password-heading">
          Změnit heslo
        </h2>
        <form
          className="mt-4 grid gap-4 sm:max-w-md"
          onSubmit={(event) => void updatePassword(event)}
        >
          <label className="grid gap-1 font-medium">
            Současné heslo
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-xl border border-line-strong px-3"
              maxLength={1024}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="grid gap-1 font-medium">
            Nové heslo (alespoň 12 znaků)
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-xl border border-line-strong px-3"
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
              className="min-h-11 rounded-xl border border-line-strong px-3"
              maxLength={1024}
              minLength={12}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
          </label>
          <button
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            Změnit heslo
          </button>
        </form>
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <button
          className="min-h-11 rounded-xl border px-4 text-left"
          disabled={busy || sync.running}
          onClick={() => void sync.run()}
          type="button"
        >
          Synchronizovat nyní
        </button>
        <button
          className="min-h-11 rounded-xl border px-4 text-left"
          disabled={busy || sync.running}
          onClick={() => void signOut(false)}
          type="button"
        >
          Odhlásit
        </button>
        <button
          className="min-h-11 rounded-xl border border-bad px-4 text-left text-bad"
          disabled={busy || sync.running}
          onClick={() => void signOut(true)}
          type="button"
        >
          Odhlásit a smazat data z tohoto zařízení
        </button>
      </div>
      {sync.pending > 0 ? (
        <p className="mt-4 text-sm text-warn">
          Na odeslání čeká {sync.pending} pokusů. Smazání dat je nevratně odstraní z tohoto
          zařízení.
        </p>
      ) : null}
      {sync.error ? (
        <p className="mt-4 text-bad" role="alert">
          {sync.error}
        </p>
      ) : null}
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
    </main>
  );
}

function ProgressionPanel({
  progression,
  isLoading,
}: Readonly<{
  progression: Awaited<ReturnType<typeof getMyProgression>> | undefined;
  isLoading: boolean;
}>) {
  if (!progression) {
    return (
      <section className="mt-6 rounded-2xl border bg-surface p-5">
        <h2 className="text-xl font-semibold">Pokrok</h2>
        <p className="mt-3" role="status">
          {isLoading ? "Načítám statistiky…" : "Osobní statistiky se nepodařilo načíst."}
        </p>
      </section>
    );
  }
  const maxDaily = Math.max(1, ...progression.trend.map((day) => day.totalAttempts));
  const progressToNext = progression.rank.nextRankAt
    ? Math.min(100, (100 * progression.correctAttempts) / progression.rank.nextRankAt)
    : 100;

  return (
    <section aria-labelledby="progress-heading" className="mt-6 rounded-2xl border bg-surface p-5">
      <h2 className="text-xl font-semibold" id="progress-heading">
        Pokrok
      </h2>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-2">Úroveň</p>
          <p className="text-2xl font-semibold text-good">{progression.rank.title}</p>
        </div>
        <p className="text-sm text-ink-2">
          {progression.rank.nextRankAt
            ? `${progression.correctAttempts} / ${progression.rank.nextRankAt} správných odpovědí k další úrovni`
            : `${progression.correctAttempts} správných odpovědí · nejvyšší úroveň`}
        </p>
      </div>
      <div
        aria-label={`Postup k další úrovni: ${Math.round(progressToNext)} procent`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progressToNext)}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-good" style={{ width: `${progressToNext}%` }} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-ink-2">Pokusy</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.totalAttempts}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-ink-2">Správně</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.correctAttempts}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-ink-2">Úspěšnost</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.accuracy} %</dd>
        </div>
      </dl>
      <h3 className="mt-6 font-semibold">Posledních 30 dní</h3>
      <ol
        aria-label="Denní počet pokusů za posledních 30 dní"
        className="mt-3 grid grid-cols-10 items-end gap-1 sm:grid-cols-[repeat(30,minmax(0,1fr))]"
      >
        {progression.trend.map((day) => (
          <li className="flex min-w-0 flex-col items-center gap-1" key={day.day}>
            <span className="text-[10px] text-ink-2">{day.totalAttempts}</span>
            <span
              aria-label={`${new Date(`${day.day}T00:00:00Z`).toLocaleDateString("cs-CZ")}: ${day.totalAttempts} pokusů, ${day.correctAttempts} správně`}
              className="w-full rounded-t bg-good"
              role="img"
              style={{ height: `${Math.max(3, (48 * day.totalAttempts) / maxDaily)}px` }}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-2">
        Souhrn vychází ze synchronizovaných pokusů. Pokusy se ukládají i bez připojení a doplní se
        po synchronizaci.
      </p>
    </section>
  );
}

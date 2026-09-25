"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { PageHeader } from "@/components/page-header";
import { ProgressReset } from "@/components/progress-reset";
import { useSync } from "@/components/sync-provider";
import { ApiError, changePassword, getMyProfile, logout, updateMyProfile } from "@/lib/api/client";
import { clearAccountMarker } from "@/lib/auth/account-marker";
import { resetLearningDatabase } from "@/lib/browser-learning-database";
import { queryKeys } from "@/lib/query-keys";
import { pendingCount } from "@/lib/sync/sync-store";

export default function AccountPage() {
  const account = useAccount();
  const { canManageProfile } = useCapabilities();
  const sync = useSync();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isGuest = !canManageProfile;
  const profile = useQuery({
    queryKey: queryKeys.me.profile,
    queryFn: getMyProfile,
    enabled: Boolean(account && !isGuest),
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

      <section
        aria-labelledby="session-heading"
        className="mt-6 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 className="text-xl font-semibold" id="session-heading">
          Synchronizace a odhlášení
        </h2>
        <p className="mt-1 text-sm text-ink-2">Stav synchronizace: {sync.label}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold"
            disabled={busy || sync.running}
            onClick={() => void sync.run()}
            type="button"
          >
            Synchronizovat nyní
          </button>
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold"
            disabled={busy || sync.running}
            onClick={() => void signOut(false)}
            type="button"
          >
            Odhlásit
          </button>
        </div>
      </section>

      <section
        aria-labelledby="danger-heading"
        className="mt-6 rounded-2xl border border-bad/40 bg-surface p-5"
      >
        <h2 className="text-xl font-semibold text-bad" id="danger-heading">
          Nebezpečná zóna
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Tyto akce nelze vrátit zpět. Každá se před provedením ještě jednou ptá.
        </p>
        <ProgressReset />
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-lg font-semibold text-ink">Data v tomto zařízení</h3>
          <p className="mt-2 text-sm text-ink-2">
            Odhlásí vás a smaže lokální karty, rozpracovaná cvičení a pokusy tohoto účtu z tohoto
            zařízení.
          </p>
          {sync.pending > 0 ? (
            <p className="mt-2 text-sm text-warn">
              Na odeslání čeká {sync.pending} pokusů. Smazání dat je nevratně odstraní z tohoto
              zařízení.
            </p>
          ) : null}
          <button
            className="mt-4 min-h-11 rounded-xl border border-bad px-4 font-semibold text-bad"
            disabled={busy || sync.running}
            onClick={() => void signOut(true)}
            type="button"
          >
            Odhlásit a smazat data z tohoto zařízení
          </button>
        </div>
      </section>
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

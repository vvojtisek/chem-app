"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";

import { ApiError, getCurrentUser, guestLogin, login } from "@/lib/api/client";
import { saveAccountMarker } from "@/lib/auth/account-marker";
import { safeNext } from "@/lib/auth/safe-next";
import { queryKeys } from "@/lib/query-keys";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const destination = safeNext(params.get("next"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function enterAccount(user: Awaited<ReturnType<typeof getCurrentUser>>) {
    saveAccountMarker(user);
    queryClient.setQueryData(queryKeys.auth.me, user);
    router.replace(destination);
    router.refresh();
  }

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        saveAccountMarker(user);
        queryClient.setQueryData(queryKeys.auth.me, user);
        router.replace(destination);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [destination, queryClient, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(identifier, password);
      enterAccount(user);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "invalid_credentials"
          ? "Nesprávný e-mail nebo heslo."
          : cause instanceof ApiError && cause.code === "too_many_attempts"
            ? "Příliš mnoho pokusů o přihlášení. Zkuste to později."
            : "Přihlášení se nepodařilo. Zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function enterGuest() {
    setError("");
    setBusy(true);
    try {
      enterAccount(await guestLogin());
    } catch {
      setError("Hostovský přístup se nepodařilo otevřít. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-slate-950">Přihlášení</h1>
      <p className="mt-2 text-slate-600">Přihlaste se e-mailem nebo pokračujte jako host.</p>
      {params.get("passwordChanged") === "1" ? (
        <p className="mt-3 text-sm text-emerald-900" role="status">
          Heslo bylo změněno. Přihlaste se novým heslem.
        </p>
      ) : null}
      <form className="mt-8 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1 font-medium">
          E-mail nebo uživatelské jméno
          <input
            autoComplete="username"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            maxLength={254}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            value={identifier}
          />
        </label>
        <label className="grid gap-1 font-medium">
          Heslo
          <input
            autoComplete="current-password"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <p aria-live="polite" className="text-sm text-rose-800" role={error ? "alert" : undefined}>
          {error}
        </p>
        <button
          className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Přihlašuji…" : "Přihlásit se"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/reset-password">
          Zapomenuté heslo
        </Link>
        <Link className="underline" href="/register">
          Vytvořit účet
        </Link>
        <Link className="underline" href="/verify-email">
          Znovu poslat potvrzení e-mailu
        </Link>
      </div>
      <button
        className="mt-6 min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900 disabled:opacity-50"
        disabled={busy}
        onClick={() => void enterGuest()}
        type="button"
      >
        Pokračovat jako host
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="p-5" role="status">
          Načítám přihlášení…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

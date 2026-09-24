"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { ApiError, requestPasswordReset, resetPassword } from "@/lib/api/client";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (token && password !== confirmation) {
      setError("Zadaná hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      if (token) {
        await resetPassword(token, password);
        router.replace("/login");
        router.refresh();
      } else {
        await requestPasswordReset(email);
        setMessage(
          "Pokud je adresa u účtu registrovaná, přijde vám e-mail s odkazem k obnově hesla.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "invalid_token"
          ? "Odkaz je neplatný nebo už vypršel. Požádejte o nový."
          : cause instanceof ApiError && cause.code === "too_many_attempts"
            ? "Příliš mnoho pokusů. Zkuste to později."
            : cause instanceof ApiError && cause.status === 503
              ? "Služba teď není dostupná. Zkuste to později."
              : "Požadavek se nepodařilo dokončit. Zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-slate-950">
        {token ? "Nastavit nové heslo" : "Obnovit heslo"}
      </h1>
      <p className="mt-2 text-slate-600">
        {token
          ? "Zvolte nové heslo alespoň o 12 znacích."
          : "Pošleme vám odkaz, pokud je e-mail spojený s účtem."}
      </p>
      <form className="mt-8 grid gap-4" onSubmit={(event) => void submit(event)}>
        {token ? (
          <>
            <label className="grid gap-1 font-medium">
              Nové heslo
              <input
                autoComplete="new-password"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                maxLength={1024}
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="grid gap-1 font-medium">
              Potvrdit nové heslo
              <input
                autoComplete="new-password"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
                maxLength={1024}
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
          </>
        ) : (
          <label className="grid gap-1 font-medium">
            E-mail
            <input
              autoComplete="email"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
        )}
        {error ? (
          <p className="text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-900" role="status">
            {message}
          </p>
        ) : null}
        <button
          className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Odesílám…" : token ? "Změnit heslo" : "Poslat odkaz"}
        </button>
      </form>
      <Link className="mt-5 self-start underline" href="/login">
        Zpět na přihlášení
      </Link>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p className="p-5" role="status">
          Načítám…
        </p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { ApiError, requestEmailVerification, verifyEmail } from "@/lib/api/client";

function VerifyEmailForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) return;
    if (password !== confirmation) {
      setError("Zadaná hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      await verifyEmail(token, password);
      setMessage("E-mail je potvrzen a heslo nastaveno. Nyní se můžete přihlásit.");
      router.replace("/verify-email");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 503
          ? "Ověřovací služba teď není dostupná. Zkuste to později."
          : cause instanceof ApiError && cause.code === "invalid_token"
            ? "Odkaz je neplatný nebo už vypršel. Požádejte o nový."
            : "E-mail se nepodařilo potvrdit. Zkuste to znovu.",
      );
      if (cause instanceof ApiError && cause.code === "invalid_token") {
        router.replace("/verify-email");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await requestEmailVerification(email);
      setMessage("Pokud čeká nepotvrzený účet, pošleme na jeho adresu nový odkaz.");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 503
          ? "E-mailové služby teď nejsou dostupné. Zkuste to později."
          : cause instanceof ApiError && cause.code === "too_many_attempts"
            ? "Příliš mnoho pokusů. Zkuste to později."
            : "Odkaz se nepodařilo poslat. Zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-ink">Potvrzení e-mailu</h1>
      {token ? (
        <form className="mt-8 grid gap-4" onSubmit={(event) => void confirmEmail(event)}>
          <p className="text-ink-2">Zvolte heslo pro svůj účet (alespoň 12 znaků).</p>
          <label className="grid gap-1 font-medium">
            Heslo
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-xl border border-line-strong px-3"
              maxLength={1024}
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label className="grid gap-1 font-medium">
            Potvrdit heslo
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-xl border border-line-strong px-3"
              maxLength={1024}
              minLength={12}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </label>
          {error ? (
            <p className="text-sm text-bad" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-good" role="status">
              {message}
            </p>
          ) : null}
          <button
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? "Potvrzuji e-mail…" : "Potvrdit e-mail a nastavit heslo"}
          </button>
        </form>
      ) : (
        <>
          <p className="mt-2 text-ink-2">Pošleme nový odkaz k potvrzení nepotvrzeného účtu.</p>
          <form className="mt-8 grid gap-4" onSubmit={(event) => void resend(event)}>
            <label className="grid gap-1 font-medium">
              E-mail
              <input
                autoComplete="email"
                className="min-h-11 rounded-xl border border-line-strong px-3"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            {error ? (
              <p className="text-sm text-bad" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-good" role="status">
                {message}
              </p>
            ) : null}
            <button
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              {busy ? "Odesílám…" : "Poslat potvrzovací odkaz"}
            </button>
          </form>
        </>
      )}
      <Link className="mt-5 self-start underline" href="/login">
        Zpět na přihlášení
      </Link>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <p className="p-5" role="status">
          Načítám…
        </p>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}

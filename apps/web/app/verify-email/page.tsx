"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ApiError, requestEmailVerification, verifyEmail } from "@/lib/api/client";

function VerifyEmailForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const openedFromToken = useRef(Boolean(token));
  const requested = useRef(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    setBusy(true);
    void verifyEmail(token)
      .then(() => {
        setMessage("E-mail je potvrzen. Nyní se můžete přihlásit.");
        router.replace("/verify-email");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError && cause.code === "invalid_token"
            ? "Odkaz je neplatný nebo už vypršel. Požádejte o nový."
            : "E-mail se nepodařilo potvrdit. Zkuste to znovu.",
        );
        router.replace("/verify-email");
      })
      .finally(() => setBusy(false));
  }, [router, token]);

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
        cause instanceof ApiError && cause.code === "too_many_attempts"
          ? "Příliš mnoho pokusů. Zkuste to později."
          : "Odkaz se nepodařilo poslat. Zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-slate-950">Potvrzení e-mailu</h1>
      {token || openedFromToken.current ? (
        <p aria-live="polite" className="mt-4 text-slate-700" role={error ? "alert" : "status"}>
          {busy ? "Ověřuji odkaz…" : error || message}
        </p>
      ) : (
        <>
          <p className="mt-2 text-slate-600">Pošleme nový odkaz k potvrzení nepotvrzeného účtu.</p>
          <form className="mt-8 grid gap-4" onSubmit={(event) => void resend(event)}>
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

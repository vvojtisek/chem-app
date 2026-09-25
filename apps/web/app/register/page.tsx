"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ApiError, registerAccount } from "@/lib/api/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await registerAccount(email);
      setMessage("Pokud lze účet vytvořit, přijde vám e-mail s odkazem k potvrzení adresy.");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 503
          ? "E-mailové služby teď nejsou dostupné. Zkuste to později."
          : cause instanceof ApiError && cause.code === "too_many_attempts"
            ? "Příliš mnoho pokusů. Zkuste to později."
            : "Registraci se nepodařilo dokončit. Zkontrolujte údaje a zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-ink">Vytvořit účet</h1>
      <p className="mt-2 text-ink-2">
        Zadejte e-mail. Heslo si nastavíte po otevření potvrzovacího odkazu.
      </p>
      <form className="mt-8 grid gap-4" onSubmit={(event) => void submit(event)}>
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
          {busy ? "Vytvářím účet…" : "Zaregistrovat se"}
        </button>
      </form>
      <Link className="mt-5 self-start underline" href="/login">
        Zpět na přihlášení
      </Link>
    </main>
  );
}

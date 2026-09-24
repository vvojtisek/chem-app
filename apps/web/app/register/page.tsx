"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ApiError, registerAccount } from "@/lib/api/client";

export default function RegisterPage() {
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
    if (password !== confirmation) {
      setError("Zadaná hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      await registerAccount(email, password);
      setMessage("Pokud lze účet vytvořit, přijde vám e-mail s odkazem k potvrzení adresy.");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "too_many_attempts"
          ? "Příliš mnoho pokusů. Zkuste to později."
          : "Registraci se nepodařilo dokončit. Zkontrolujte údaje a zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold text-slate-950">Vytvořit účet</h1>
      <p className="mt-2 text-slate-600">Po registraci potvrďte svou e-mailovou adresu.</p>
      <form className="mt-8 grid gap-4" onSubmit={(event) => void submit(event)}>
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
        <label className="grid gap-1 font-medium">
          Heslo (alespoň 12 znaků)
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
          Potvrdit heslo
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
          {busy ? "Vytvářím účet…" : "Zaregistrovat se"}
        </button>
      </form>
      <Link className="mt-5 self-start underline" href="/login">
        Zpět na přihlášení
      </Link>
    </main>
  );
}

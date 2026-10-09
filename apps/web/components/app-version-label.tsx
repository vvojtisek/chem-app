"use client";

import { useEffect, useState } from "react";

import {
  ApiError,
  applyLatestRelease,
  getLatestRelease,
  type LatestRelease,
} from "@/lib/api/client";
import { APP_VERSION, isNewerVersion } from "@/lib/app-version";
import { useAccount } from "./auth-gate";

const RELEASES_ORIGIN = "https://github.com/";

const UPDATE_ERRORS: Record<string, string> = {
  updates_disabled: "Aktualizace z aplikace nejsou na tomto serveru zapnuté.",
  update_in_progress: "Aktualizace už probíhá.",
  too_many_attempts: "Příliš mnoho pokusů o aktualizaci. Zkuste to později.",
};

type UpdateState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "started" }
  | { status: "failed"; message: string };

/**
 * Shows the running version. When a newer release is published, administrators
 * also get a button that asks the server to apply it (ADR 0012) and a link to
 * its release notes. Everyone else sees only the version.
 */
export function AppVersionLabel() {
  const account = useAccount();
  const isAdmin = account?.role === "admin";
  const [latest, setLatest] = useState<LatestRelease | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    function refresh() {
      getLatestRelease()
        .then((release) => {
          if (active) setLatest(release);
        })
        .catch(() => {
          // Release information is optional; the last known state stays visible.
        });
    }
    // The header stays mounted across navigation, so ask again whenever the tab
    // comes back into view; otherwise a release published later never shows.
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    refresh();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAdmin]);

  const update =
    isAdmin &&
    latest?.latestVersion &&
    latest.releaseUrl?.startsWith(RELEASES_ORIGIN) &&
    isNewerVersion(latest.latestVersion, APP_VERSION)
      ? { version: latest.latestVersion, url: latest.releaseUrl }
      : null;

  async function startUpdate(version: string) {
    const confirmed = window.confirm(
      `Aktualizovat aplikaci na v${version}? Server stáhne novou verzi a restartuje se; aplikace bude několik minut nedostupná.`,
    );
    if (!confirmed) return;
    setUpdateState({ status: "busy" });
    try {
      await applyLatestRelease();
      setUpdateState({ status: "started" });
    } catch (cause) {
      const known = cause instanceof ApiError ? UPDATE_ERRORS[cause.code] : undefined;
      setUpdateState({ status: "failed", message: known ?? "Aktualizaci se nepodařilo spustit." });
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-2 text-xs">
      <span className="text-ink-3" title="Verze aplikace">
        v{APP_VERSION}
      </span>
      {update ? (
        <>
          {updateState.status === "started" ? (
            <span role="status" className="font-semibold text-accent">
              Aktualizace spuštěna, aplikace se za chvíli restartuje.
            </span>
          ) : (
            <button
              type="button"
              className="rounded-full border border-accent px-2 py-0.5 font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
              disabled={updateState.status === "busy"}
              onClick={() => void startUpdate(update.version)}
            >
              {updateState.status === "busy"
                ? "Spouštím aktualizaci…"
                : `Aktualizovat na v${update.version}`}
            </button>
          )}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={update.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Co je nového
            <span className="sr-only"> ve verzi v{update.version} (otevře se v novém okně)</span>
          </a>
          {updateState.status === "failed" ? (
            <span role="alert" className="text-bad">
              {updateState.message}
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}

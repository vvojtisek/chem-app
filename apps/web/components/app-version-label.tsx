"use client";

import { useEffect, useState } from "react";

import { getLatestRelease, type LatestRelease } from "@/lib/api/client";
import { APP_VERSION, isNewerVersion } from "@/lib/app-version";
import { useAccount } from "./auth-gate";

const RELEASES_ORIGIN = "https://github.com/";

/**
 * Shows the running version. Administrators also see a link to the release notes when a
 * newer release is published. The link is informational: updating the server stays a
 * deliberate deployment step outside the web application.
 */
export function AppVersionLabel() {
  const account = useAccount();
  const isAdmin = account?.role === "admin";
  const [latest, setLatest] = useState<LatestRelease | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    getLatestRelease()
      .then((release) => {
        if (active) setLatest(release);
      })
      .catch(() => {
        // Release information is optional; the plain version stays visible.
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const update =
    isAdmin &&
    latest?.latestVersion &&
    latest.releaseUrl?.startsWith(RELEASES_ORIGIN) &&
    isNewerVersion(latest.latestVersion, APP_VERSION)
      ? { version: latest.latestVersion, url: latest.releaseUrl }
      : null;

  return (
    <span className="flex shrink-0 items-center gap-2 text-xs">
      <span className="text-ink-3" title="Verze aplikace">
        v{APP_VERSION}
      </span>
      {update ? (
        <a
          className="rounded-full border border-accent px-2 py-0.5 font-semibold text-accent underline-offset-2 hover:underline"
          href={update.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Nová verze v{update.version}
          <span className="sr-only"> (poznámky k vydání se otevřou v novém okně)</span>
        </a>
      ) : null}
    </span>
  );
}

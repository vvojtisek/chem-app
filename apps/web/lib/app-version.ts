import packageInfo from "../package.json";

export const APP_VERSION = packageInfo.version;

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(version: string): readonly [number, number, number] | null {
  const match = VERSION_PATTERN.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** True when `candidate` is a strictly higher MAJOR.MINOR.PATCH version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  if (!next || !installed) return false;
  const [nextMajor, nextMinor, nextPatch] = next;
  const [major, minor, patch] = installed;
  if (nextMajor !== major) return nextMajor > major;
  if (nextMinor !== minor) return nextMinor > minor;
  return nextPatch > patch;
}

/**
 * Asks the web server which build it is running. Returns null while the server
 * is unreachable or answers with anything other than a version, which is
 * expected while an update restarts the containers.
 */
export async function fetchServedVersion(): Promise<string | null> {
  const response = await fetch("/app-version", {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "manual",
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("version" in body)) return null;
  return typeof body.version === "string" && VERSION_PATTERN.test(body.version)
    ? body.version
    : null;
}

/** Loads the page again so the browser picks up the newly deployed build. */
export function reloadIntoNewBuild(): void {
  window.location.reload();
}

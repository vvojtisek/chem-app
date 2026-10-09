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

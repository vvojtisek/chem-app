// Small, non-sensitive preferences in localStorage (ADR 0003). They are a convenience:
// blocked or full storage (DOMException) and corrupt JSON (SyntaxError) read as "nothing
// stored", so callers fall back to their defaults instead of breaking practice.

export function readStoredJson(key: string): unknown {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

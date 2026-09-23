export function safeNext(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const parsed = new URL(value, "https://example.invalid");
    if (parsed.origin !== "https://example.invalid" || parsed.pathname === "/login") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

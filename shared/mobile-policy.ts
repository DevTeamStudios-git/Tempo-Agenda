export function isTrustedWorkspaceUrl(url: string, origin: string) {
  try {
    const target = new URL(url);
    return (
      (target.protocol === "https:" || target.protocol === "http:") &&
      target.origin === origin
    );
  } catch {
    return false;
  }
}
export function workspaceNavigation(
  url: string,
  origin: string,
): "internal" | "external" | "blocked" {
  if (isTrustedWorkspaceUrl(url, origin) || url === "about:blank")
    return "internal";
  try {
    const protocol = new URL(url).protocol;
    return ["https:", "http:", "mailto:", "tel:"].includes(protocol)
      ? "external"
      : "blocked";
  } catch {
    return "blocked";
  }
}
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/",
) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const target = new URL(value, "https://tempo.invalid");
    return target.origin === "https://tempo.invalid"
      ? target.pathname + target.search + target.hash
      : fallback;
  } catch {
    return fallback;
  }
}

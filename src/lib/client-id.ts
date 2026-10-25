/** UI-only identifiers; works in development WebViews where randomUUID requires HTTPS. */
export function clientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 15) | 64;
    bytes[8] = (bytes[8]! & 63) | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

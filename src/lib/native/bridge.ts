import { clientId } from "@/lib/client-id";
export type NativeRequest =
  | { type: "tempo:oauth"; provider: "google" }
  | {
      type: "tempo:save";
      id: string;
      filename: string;
      mime: string;
      content: string;
    }
  | { type: "tempo:print"; id: string; html: string };
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (value: string) => void };
  }
}
export function isNativeApp() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}
export function postNative(message: NativeRequest) {
  if (!isNativeApp()) return false;
  window.ReactNativeWebView!.postMessage(JSON.stringify(message));
  return true;
}
export function saveFile(content: string, filename: string, mime: string) {
  if (
    postNative({ type: "tempo:save", id: clientId(), content, filename, mime })
  )
    return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

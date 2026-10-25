"use client";
import { clientId } from "@/lib/client-id";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isNativeApp } from "@/lib/native/bridge";
import { setTheme } from "@/lib/theme";
export function NativeBridge() {
  const client = useQueryClient();
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = "true";
    try {
      if (!localStorage.getItem("tempo-theme")) setTheme("dark");
    } catch {}
    const post = (message: unknown) =>
      window.ReactNativeWebView?.postMessage(JSON.stringify(message));
    const publishTheme = () => {
      const style = getComputedStyle(document.documentElement);
      post({
        type: "tempo:theme",
        background: style.getPropertyValue("--bg").trim(),
        dark:
          document.documentElement.dataset.theme === "dark" ||
          (document.documentElement.dataset.theme !== "light" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches),
      });
    };
    const observer = new MutationObserver(publishTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", publishTheme);
    publishTheme();
    const originalPrint = window.print;
    window.print = () => {
      const target = document.getElementById("print-root");
      if (!target) return;
      const css = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("\n");
          } catch {
            return "";
          }
        })
        .join("\n");
      const head = "<style>" + css + "</style>";
      post({
        type: "tempo:print",
        id: clientId(),
        html:
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
          head +
          '</head><body class="printing">' +
          target.outerHTML +
          "</body></html>",
      });
    };
    let applying = false;
    const message = async (event: MessageEvent) => {
      if (event.source && event.source !== window) return;
      if (event.origin && event.origin !== location.origin) return;
      let data;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (data.type === "tempo:foreground") {
        void client.invalidateQueries();
        return;
      }
      if (data.type === "tempo:result") {
        if (data.kind === "print")
          window.dispatchEvent(new Event("afterprint"));
        if (data.error)
          window.dispatchEvent(
            new CustomEvent("tempo-native-error", {
              detail: String(data.error),
            }),
          );
        return;
      }
      if (
        data.type !== "tempo:session" ||
        location.pathname !== "/mobile/connect" ||
        applying
      )
        return;
      if (
        typeof data.accessToken !== "string" ||
        typeof data.refreshToken !== "string" ||
        data.accessToken.length > 16384 ||
        data.refreshToken.length > 16384
      )
        return;
      applying = true;
      try {
        const { error } = await createSupabaseBrowserClient().auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });
        if (error) throw error;
        post({ type: "tempo:session-applied" });
        location.replace("/mobile");
      } catch (error) {
        applying = false;
        post({ type: "tempo:error", message: (error as Error).message });
      }
    };
    const back = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(".ov .dlg");
      const dialog = dialogs.item(dialogs.length - 1);
      if (dialog) {
        const close =
          dialog.querySelector<HTMLButtonElement>(
            'button[aria-label="Close"]:not(:disabled)',
          ) ??
          Array.from(
            dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
          ).find((button) =>
            /^(Close|Cancel|Done)$/.test(button.textContent?.trim() ?? ""),
          );
        if (close) close.click();
        else
          document.activeElement?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
        return;
      }
      if (document.querySelector(".side.open")) {
        document.getElementById("menu")?.click();
        return;
      }
      post({ type: "tempo:back-unhandled" });
    };
    const documentMessage = (event: Event) => {
      if (event instanceof MessageEvent) void message(event);
    };
    window.addEventListener("tempo-native-back", back);
    window.addEventListener("message", message);
    document.addEventListener("message", documentMessage);
    if (location.pathname === "/mobile/connect")
      post({ type: "tempo:session-ready" });
    return () => {
      observer.disconnect();
      media.removeEventListener("change", publishTheme);
      window.print = originalPrint;
      window.removeEventListener("message", message);
      document.removeEventListener("message", documentMessage);
      window.removeEventListener("tempo-native-back", back);
      delete document.documentElement.dataset.native;
    };
  }, [client]);
  return null;
}

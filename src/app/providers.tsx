"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { initTheme } from "@/lib/theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000 },
      mutations: { retry: 0 },
    },
  }));
  useEffect(() => initTheme(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

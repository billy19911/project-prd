"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { UpgradeProvider } from "@/components/upgrade-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UpgradeProvider>
        {children}
        <Toaster
          richColors
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </UpgradeProvider>
    </SessionProvider>
  );
}

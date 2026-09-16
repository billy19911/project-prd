"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { UpgradePlanModal } from "@/components/upgrade-plan-modal";

type UpgradeContextValue = {
  open: (opts?: { title?: string; message?: string; highlight?: string }) => void;
  close: () => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within <UpgradeProvider>");
  return ctx;
}

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<{
    title?: string;
    message?: string;
    highlight?: string;
  }>({});

  const openModal = useCallback(
    (o?: { title?: string; message?: string; highlight?: string }) => {
      setOpts(o ?? {});
      setOpen(true);
    },
    []
  );

  const close = useCallback(() => setOpen(false), []);

  return (
    <UpgradeContext.Provider value={{ open: openModal, close }}>
      {children}
      <UpgradePlanModal
        open={open}
        onClose={close}
        title={opts.title}
        message={opts.message}
        highlight={opts.highlight}
      />
    </UpgradeContext.Provider>
  );
}

"use client";

import { useEffect } from "react";
import { loadCompany, subscribeRealtime } from "@/lib/data/company";
import { getBrowserClient } from "@/lib/supabase/client";
import { useEmployeeStore } from "@/store/employees";

/**
 * Boots company data: demo roster when Supabase isn't configured, otherwise the signed-in
 * CEO's real data plus a Realtime subscription that keeps the 3D office in sync.
 */
export function CompanyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sb = getBrowserClient();
    const store = useEmployeeStore.getState();
    if (!sb) {
      store.initDemo();
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    store.setLoading();
    loadCompany(sb)
      .then(({ userId, ...data }) => {
        if (cancelled) return;
        if (!userId) throw new Error("You are signed out. Reload to sign in again.");
        useEmployeeStore.getState().setLive(data);
        unsubscribe = subscribeRealtime(sb, userId);
      })
      .catch((e: unknown) => {
        if (!cancelled) useEmployeeStore.getState().setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return children;
}

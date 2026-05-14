"use client";

import { createContext, useCallback, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries";

interface RefreshContextValue {
  /** Re-fetch every B2-backed query (library, stats, activity). */
  triggerRefresh: () => void;
  refreshKey: number;
}

const RefreshContext = createContext<RefreshContextValue>({
  triggerRefresh: () => {},
  refreshKey: 0,
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const triggerRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.all });
  }, [qc]);

  return (
    <RefreshContext.Provider value={{ triggerRefresh, refreshKey: 0 }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}

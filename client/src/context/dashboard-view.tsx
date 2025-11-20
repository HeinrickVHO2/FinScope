import { createContext, useContext, useState, type ReactNode } from "react";

export type DashboardScope = "PF" | "PJ" | "ALL";

interface DashboardViewContextValue {
  selectedView: DashboardScope;
  setSelectedView: (scope: DashboardScope) => void;
}

const DashboardViewContext = createContext<DashboardViewContextValue | undefined>(undefined);

export function DashboardViewProvider({ children }: { children: ReactNode }) {
  const [selectedView, setSelectedView] = useState<DashboardScope>("PF");

  return (
    <DashboardViewContext.Provider value={{ selectedView, setSelectedView }}>
      {children}
    </DashboardViewContext.Provider>
  );
}

export function useDashboardView() {
  const context = useContext(DashboardViewContext);
  if (!context) {
    throw new Error("useDashboardView must be used within DashboardViewProvider");
  }
  return context;
}

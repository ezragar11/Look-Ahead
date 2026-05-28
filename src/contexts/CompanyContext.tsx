"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status: string;
  _count?: { projects: number; companyUsers: number };
}

interface CompanyContextValue {
  companies:        CompanySummary[];
  activeCompany:    CompanySummary | null;
  setActiveCompany: (c: CompanySummary) => void;
  refreshCompanies: () => Promise<void>;
  loading:          boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  companies:        [],
  activeCompany:    null,
  setActiveCompany: () => {},
  refreshCompanies: async () => {},
  loading:          true,
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies]               = useState<CompanySummary[]>([]);
  const [activeCompany, setActiveCompanyRaw]     = useState<CompanySummary | null>(null);
  const [loading, setLoading]                    = useState(true);

  const refreshCompanies = useCallback(async () => {
    try {
      const res  = await fetch("/api/companies");
      if (!res.ok) return;
      const data: CompanySummary[] = await res.json();
      setCompanies(data);

      const savedSlug = typeof window !== "undefined"
        ? localStorage.getItem("lookAhead_activeCompanySlug")
        : null;
      const saved = savedSlug ? data.find((c) => c.slug === savedSlug) : null;
      setActiveCompanyRaw(saved ?? data[0] ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshCompanies(); }, [refreshCompanies]);

  const setActiveCompany = useCallback((c: CompanySummary) => {
    setActiveCompanyRaw(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("lookAhead_activeCompanySlug", c.slug);
    }
  }, []);

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompany, refreshCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

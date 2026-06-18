import { useEffect, useState } from "react";

// Lightweight cross-page portfolio store. The /portfolio route already keeps
// holdings in localStorage; this hook reads/writes the same key so the
// Optimizer, Goal Planner, and Tax Center can all share the same data.

export interface Holding {
  id: string;             // stable id
  symbol: string;
  name: string;
  type: "stock" | "fund";
  qty: number;            // shares OR units
  avgCost: number;        // ₹ per share/unit
  buyDate?: string;       // ISO date
  sector?: string;
  category?: string;      // mutual-fund category key (e.g. "elss")
  schemeCode?: number;    // mutual-fund mfapi.in code
}

const KEY = "dx_holdings_v2";

function safeLoad(): Holding[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v as Holding[] : [];
  } catch { return []; }
}

function safeSave(rows: Holding[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* noop */ }
}

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  useEffect(() => { setHoldings(safeLoad()); }, []);

  const add = (h: Omit<Holding, "id">) => {
    const row: Holding = { ...h, id: crypto.randomUUID() };
    setHoldings((p) => { const n = [...p, row]; safeSave(n); return n; });
  };
  const update = (id: string, patch: Partial<Holding>) => {
    setHoldings((p) => { const n = p.map((h) => h.id === id ? { ...h, ...patch } : h); safeSave(n); return n; });
  };
  const remove = (id: string) => {
    setHoldings((p) => { const n = p.filter((h) => h.id !== id); safeSave(n); return n; });
  };
  const reload = () => setHoldings(safeLoad());

  return { holdings, add, update, remove, reload };
}

export function readHoldings(): Holding[] { return safeLoad(); }

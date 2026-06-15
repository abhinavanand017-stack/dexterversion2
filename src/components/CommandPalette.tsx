import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ArrowRight, Clock } from "lucide-react";
import { STOCK_UNIVERSE } from "@/lib/stockUniverse";
import { NAV_ITEMS } from "@/components/AppSidebar";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type Result =
  | { kind: "page"; label: string; to: string }
  | { kind: "stock"; label: string; symbol: string }
  | { kind: "fund"; label: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useLocalStorage<string[]>("dx_cmdk_recent", []);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const Q = q.trim().toUpperCase();
  const pages: Result[] = NAV_ITEMS.filter((n) => !Q || n.label.toUpperCase().includes(Q)).map(
    (n) => ({ kind: "page", label: n.label, to: n.to }),
  );
  const stocks: Result[] = (Q
    ? STOCK_UNIVERSE.filter((s) => s.symbol.includes(Q) || s.name.toUpperCase().includes(Q))
    : STOCK_UNIVERSE.slice(0, 8)
  )
    .slice(0, 10)
    .map((s) => ({ kind: "stock", label: `${s.name} (${s.symbol})`, symbol: s.symbol }));

  const select = (r: Result) => {
    setRecent([q || r.label, ...recent.filter((x) => x !== (q || r.label))].slice(0, 6));
    if (r.kind === "page") navigate({ to: r.to as never });
    else if (r.kind === "stock") navigate({ to: "/screener", search: { q: r.symbol } as never });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl mx-4 dx-glass rounded-xl overflow-hidden shadow-2xl dx-glow-cyan">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-primary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stocks, funds, pages…  (ESC to close)"
            className="flex-1 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {!Q && recent.length > 0 && (
            <Section title="Recent">
              {recent.map((r) => (
                <button key={r} onClick={() => setQ(r)} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-primary/10 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{r}</span>
                </button>
              ))}
            </Section>
          )}
          <Section title="Pages">
            {pages.map((r) => (
              <button key={r.label} onClick={() => select(r)} className="flex w-full items-center justify-between gap-2 px-4 py-2 hover:bg-primary/10 text-sm">
                <span>{r.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </Section>
          <Section title="Stocks">
            {stocks.length === 0 && <div className="px-4 py-2 text-xs text-muted-foreground">No matches</div>}
            {stocks.map((r) => (
              <button key={r.label} onClick={() => select(r)} className="flex w-full items-center justify-between gap-2 px-4 py-2 hover:bg-primary/10 text-sm">
                <span className="font-mono">{r.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{title}</div>
      {children}
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

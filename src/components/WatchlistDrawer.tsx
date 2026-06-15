import { useState } from "react";
import { Star, X, TrendingUp, TrendingDown } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STOCK_UNIVERSE } from "@/lib/stockUniverse";
import { toast } from "sonner";

export interface WatchItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

const WL_KEY = "dx_watchlist";

export function useWatchlist() {
  const [items, setItems] = useLocalStorage<WatchItem[]>(WL_KEY, []);
  const add = (symbol: string) => {
    if (items.find((i) => i.symbol === symbol)) {
      toast.message(`${symbol} already in watchlist`);
      return;
    }
    const s = STOCK_UNIVERSE.find((x) => x.symbol === symbol);
    if (!s) return;
    const pct = ((s.price - (s.week52Low + s.week52High) / 2) / s.price) * 5;
    setItems([...items, { symbol: s.symbol, name: s.name, price: s.price, changePct: pct }]);
    toast.success(`Added ${symbol} to Watchlist`);
  };
  const remove = (symbol: string) => setItems(items.filter((i) => i.symbol !== symbol));
  return { items, add, remove };
}

function Sparkline({ seed }: { seed: number }) {
  // Deterministic-ish 7-bar sparkline
  const vals = Array.from({ length: 7 }, (_, i) => 0.5 + 0.5 * Math.sin(seed + i * 0.7));
  const max = Math.max(...vals);
  return (
    <svg width="56" height="20" viewBox="0 0 56 20">
      {vals.map((v, i) => {
        const h = (v / max) * 18 + 2;
        return <rect key={i} x={i * 8} y={20 - h} width="6" height={h} fill="var(--primary)" opacity={0.6 + i * 0.05} />;
      })}
    </svg>
  );
}

export function WatchlistDrawer() {
  const [open, setOpen] = useState(false);
  const { items, remove } = useWatchlist();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg dx-glow-cyan flex items-center justify-center hover:scale-110 transition"
        aria-label="Open watchlist"
      >
        <Star className="h-5 w-5 fill-current" />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm h-full bg-card border-l border-border overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" /> My Watchlist</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-3 space-y-2">
              {items.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No items yet.<br /><span className="text-xs">Add stocks from /screener.</span>
                </div>
              )}
              {items.map((it) => {
                const up = it.changePct >= 0;
                return (
                  <div key={it.symbol} className="dx-glass p-3 rounded-lg flex items-center gap-3 hover:dx-glow-cyan transition">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-muted-foreground">{it.symbol}</div>
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-mono text-sm">₹{it.price.toFixed(2)}</span>
                        <span className={"text-xs " + (up ? "text-emerald-400" : "text-red-400")}>
                          {up ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                          {" "}{up ? "+" : ""}{it.changePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <Sparkline seed={it.symbol.charCodeAt(0) / 10} />
                    <button onClick={() => remove(it.symbol)} className="text-muted-foreground hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

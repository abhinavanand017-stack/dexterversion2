import { useEffect, useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { NIFTY500, BUCKET_LABEL, searchStocks, type NiftyStock, type IndexBucket } from "@/lib/nifty500";
import { FUND_UNIVERSE, FUND_CATEGORY_LABELS, searchFunds, type CuratedFund } from "@/lib/fundUniverse";

const STOCK_RECENT_KEY = "dx_recent_stocks_v1";
const FUND_RECENT_KEY = "dx_recent_funds_v1";

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) as T : fallback;
  } catch { return fallback; }
}
function safeSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}
function pushRecent<T extends { id: string }>(key: string, item: T, max = 5) {
  const list = safeGet<T[]>(key, []);
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, max);
  safeSet(key, next);
  return next;
}

interface RecentRef { id: string; label: string; sub: string }

// ===================== StockCombobox =====================

interface StockComboboxProps {
  value?: NiftyStock | null;
  onChange: (stock: NiftyStock) => void;
  className?: string;
}

export function StockCombobox({ value, onChange, className }: StockComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentRef[]>([]);

  useEffect(() => { setRecents(safeGet<RecentRef[]>(STOCK_RECENT_KEY, [])); }, [open]);

  const handlePick = (s: NiftyStock) => {
    onChange(s);
    setRecents(pushRecent(STOCK_RECENT_KEY, { id: s.symbol, label: s.symbol, sub: s.name }));
    setOpen(false);
    setQuery("");
  };

  const filtered = useMemo(() => searchStocks(query, 200), [query]);
  const showGrouped = query.trim() === "";

  const grouped = useMemo(() => {
    const buckets: IndexBucket[] = ["nifty50", "next50", "midcap150", "smallcap250"];
    return buckets.map((b) => ({ bucket: b, items: NIFTY500.filter((s) => s.bucket === b) }));
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={"flex items-center justify-between gap-2 px-3 py-2 rounded border border-border bg-background/40 hover:bg-card/60 text-sm w-full " + (className ?? "")}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {value ? (
              <span className="truncate"><span className="font-mono font-semibold text-foreground">{value.symbol}</span>
                <span className="text-muted-foreground"> — {value.name}</span></span>
            ) : (
              <span className="text-muted-foreground">Search Nifty 500 stocks by name or symbol…</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px] max-w-[560px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search Nifty 500 stocks by name or symbol…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No matches.</CommandEmpty>

            {recents.length > 0 && showGrouped && (
              <CommandGroup heading="Recent">
                {recents.map((r) => (
                  <CommandItem key={r.id} value={`recent-${r.id}`} onSelect={() => {
                    const s = NIFTY500.find((x) => x.symbol === r.id);
                    if (s) handlePick(s);
                  }}>
                    <span className="font-mono font-semibold mr-2">{r.label}</span>
                    <span className="text-muted-foreground truncate">{r.sub}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showGrouped
              ? grouped.map((g) => (
                  <CommandGroup key={g.bucket} heading={BUCKET_LABEL[g.bucket] + ` (${g.items.length})`}>
                    {g.items.map((s) => <Row key={s.symbol + g.bucket} s={s} pick={handlePick} selected={value?.symbol === s.symbol} />)}
                  </CommandGroup>
                ))
              : (
                <CommandGroup heading={`Results (${filtered.length})`}>
                  {filtered.map((s) => <Row key={s.symbol} s={s} pick={handlePick} selected={value?.symbol === s.symbol} />)}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Row({ s, pick, selected }: { s: NiftyStock; pick: (s: NiftyStock) => void; selected?: boolean }) {
  return (
    <CommandItem value={s.symbol + " " + s.name} onSelect={() => pick(s)} className="gap-2">
      <span className="font-mono font-semibold text-foreground w-20 shrink-0">{s.symbol}</span>
      <span className="flex-1 truncate">{s.name}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-card/60 text-muted-foreground shrink-0">{s.sector}</span>
      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
    </CommandItem>
  );
}

// ===================== FundCombobox =====================

interface FundComboboxProps {
  value?: CuratedFund | null;
  onChange: (fund: CuratedFund) => void;
  className?: string;
}

export function FundCombobox({ value, onChange, className }: FundComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentRef[]>([]);

  useEffect(() => { setRecents(safeGet<RecentRef[]>(FUND_RECENT_KEY, [])); }, [open]);

  const handlePick = (f: CuratedFund) => {
    onChange(f);
    setRecents(pushRecent(FUND_RECENT_KEY, { id: String(f.code), label: f.name, sub: f.house }));
    setOpen(false);
    setQuery("");
  };

  const showGrouped = query.trim() === "";

  const grouped = useMemo(() => {
    const map = new Map<string, CuratedFund[]>();
    for (const f of FUND_UNIVERSE) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({ cat, items }));
  }, []);

  const filtered = useMemo(() => searchFunds(query, 200), [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={"flex items-center justify-between gap-2 px-3 py-2 rounded border border-border bg-background/40 hover:bg-card/60 text-sm w-full " + (className ?? "")}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {value ? (
              <span className="truncate text-foreground">{value.name}</span>
            ) : (
              <span className="text-muted-foreground">Search funds by name, AMC or category…</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px] max-w-[640px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search funds by name, AMC or category…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No matches.</CommandEmpty>
            {recents.length > 0 && showGrouped && (
              <CommandGroup heading="Recent">
                {recents.map((r) => (
                  <CommandItem key={r.id} value={`recent-${r.id}`} onSelect={() => {
                    const f = FUND_UNIVERSE.find((x) => String(x.code) === r.id);
                    if (f) handlePick(f);
                  }}>
                    <span className="truncate">{r.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showGrouped
              ? grouped.map((g) => (
                  <CommandGroup key={g.cat} heading={`${FUND_CATEGORY_LABELS[g.cat] || g.cat} (${g.items.length})`}>
                    {g.items.map((f) => <FundRow key={f.code + g.cat} f={f} pick={handlePick} selected={value?.code === f.code} />)}
                  </CommandGroup>
                ))
              : (
                <CommandGroup heading={`Results (${filtered.length})`}>
                  {filtered.map((f) => <FundRow key={f.code} f={f} pick={handlePick} selected={value?.code === f.code} />)}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FundRow({ f, pick, selected }: { f: CuratedFund; pick: (f: CuratedFund) => void; selected?: boolean }) {
  return (
    <CommandItem value={f.name + " " + f.house + " " + f.category} onSelect={() => pick(f)} className="gap-2">
      <span className="w-7 h-7 rounded bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{f.house.slice(0, 2).toUpperCase()}</span>
      <span className="flex-1 truncate">
        <div className="truncate text-foreground">{f.name}</div>
        <div className="text-[10px] text-muted-foreground">{f.house} · {FUND_CATEGORY_LABELS[f.category] || f.category}</div>
      </span>
      {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </CommandItem>
  );
}

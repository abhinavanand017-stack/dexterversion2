import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, ChevronDown, Upload, RotateCcw, Database, Radio } from "lucide-react";
import { getDataMode, setDataMode, getStore, setOverride, resetOverride, parseCsv } from "@/lib/dataProvider";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Dexter — Settings" }] }),
  component: SettingsPage,
});

const EXTRA = [
  { to: "/scanner", label: "Market Scanner" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/backtester", label: "Backtester" },
  { to: "/demat", label: "Demat" },
  { to: "/pitch", label: "Pitch Deck" },
] as const;

type Provider = "demo" | "gnews" | "newsdata";

function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("demo");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setProvider((localStorage.getItem("dexter_news_provider") as Provider) || "demo");
    setKey(localStorage.getItem("dexter_news_key") || "");
  }, []);

  const save = () => {
    localStorage.setItem("dexter_news_provider", provider);
    localStorage.setItem("dexter_news_key", key);
    setTest({ ok: true, msg: "Saved" });
  };

  const runTest = async () => {
    setTesting(true); setTest(null);
    try {
      let url = "";
      if (provider === "gnews") url = `https://gnews.io/api/v4/search?q=nifty&lang=en&country=in&max=5&apikey=${encodeURIComponent(key)}`;
      else if (provider === "newsdata") url = `https://newsdata.io/api/1/news?country=in&category=business&language=en&apikey=${encodeURIComponent(key)}`;
      else { setTest({ ok: true, msg: "Demo mode — no key required" }); setTesting(false); return; }
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const count = (j.articles?.length ?? j.results?.length ?? 0) as number;
      setTest({ ok: count > 0, msg: count > 0 ? `Connected — ${count} articles loaded` : "Empty response" });
      if (count > 0) save();
    } catch (e) {
      setTest({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally { setTesting(false); }
  };

  return (
    <div className="grid gap-4 dx-fade-in max-w-3xl">
      <div className="dx-glass p-6">
        <h2 className="font-display text-xl mb-4">Data Connections</h2>

        <label className="text-xs uppercase text-muted-foreground font-mono">News provider</label>
        <div className="flex gap-2 mt-1 mb-3">
          {(["demo","gnews","newsdata"] as Provider[]).map((p) => (
            <button key={p} onClick={() => setProvider(p)} data-active={provider === p}
              className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground capitalize">
              {p === "demo" ? "Demo" : p}
            </button>
          ))}
        </div>

        <label className="text-xs uppercase text-muted-foreground font-mono">API key</label>
        <div className="mt-1 flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-border bg-background/40">
            <input
              type={show ? "text" : "password"}
              value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={provider === "demo" ? "No key needed" : "Paste your key…"}
              disabled={provider === "demo"}
              className="flex-1 bg-transparent outline-none text-sm font-mono"
            />
            <button onClick={() => setShow((s) => !s)} className="text-muted-foreground" aria-label="toggle key visibility">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={runTest} disabled={testing}
            className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {testing ? "Testing…" : "Test & save"}
          </button>
        </div>
        {test && (
          <div className="mt-2 text-sm flex items-center gap-2" style={{ color: test.ok ? "#00ff88" : "#ff4466" }}>
            {test.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {test.msg}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Free keys: <a className="underline" href="https://gnews.io" target="_blank" rel="noreferrer">gnews.io</a> ·{" "}
          <a className="underline" href="https://newsdata.io" target="_blank" rel="noreferrer">newsdata.io</a>.
          Stored in your browser only.
        </p>

        <button onClick={() => setShowInfo((s) => !s)} className="mt-5 flex items-center gap-2 text-sm">
          <ChevronDown className={`w-4 h-4 transition ${showInfo ? "rotate-180" : ""}`} /> Forecaster info
        </button>
        {showInfo && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p>Stock data via Yahoo Finance API (free, proxied through this server).</p>
            <p>Mutual fund NAV via <a className="underline" href="https://mfapi.in" target="_blank" rel="noreferrer">MFAPI.in</a> (free).</p>
            <p>All 17 forecasting models run locally in your browser. No data is sent to any server.</p>
          </div>
        )}
      </div>

      <ForecasterDataPanel />

      <div className="dx-glass p-6">
        <h2 className="font-display text-xl mb-2">Modules</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {EXTRA.map((e) => (
            <Link key={e.to} to={e.to} className="dx-pill hover:opacity-80">{e.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Forecaster data source & manual refresh ============
function ForecasterDataPanel() {
  const [mode, setMode] = useState<"static" | "live">("static");
  const [endpoint, setEndpoint] = useState("");
  const [asOf, setAsOf] = useState("");
  const [source, setSource] = useState<"bundled" | "user-upload">("bundled");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const stockRef = useRef<HTMLInputElement>(null);
  const fundRef = useRef<HTMLInputElement>(null);
  const etfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(getDataMode());
    setEndpoint(localStorage.getItem("dx_live_data_endpoint") || "");
    const s = getStore();
    setAsOf(s.asOf); setSource(s.source);
  }, []);

  const flipMode = (m: "static" | "live") => { setDataMode(m); setMode(m); setMsg({ ok: true, text: `Data mode set to ${m}. Reload to apply everywhere.` }); };
  const saveEndpoint = () => { localStorage.setItem("dx_live_data_endpoint", endpoint); setMsg({ ok: true, text: "Live endpoint saved." }); };

  const upload = async (kind: "stocks" | "funds" | "etfs", file: File) => {
    try {
      const text = await file.text();
      let rows: unknown[];
      if (file.name.toLowerCase().endsWith(".json")) rows = JSON.parse(text);
      else rows = parseCsv(text);
      const s = setOverride(kind, rows, `${file.name} · ${new Date().toLocaleDateString()}`);
      setAsOf(s.asOf); setSource(s.source);
      setMsg({ ok: true, text: `${kind}: ${rows.length} rows loaded. Reload the Forecaster to see updates.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Parse failed" });
    }
  };

  const reset = () => { const s = resetOverride(); setAsOf(s.asOf); setSource(s.source); setMsg({ ok: true, text: "Reverted to bundled dataset." }); };

  return (
    <div className="dx-glass p-6">
      <h2 className="font-display text-xl mb-1">Forecaster Data Source</h2>
      <p className="text-xs text-muted-foreground mb-4">Static bundle works offline with zero external API calls. Flip to Live when a data endpoint is configured.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => flipMode("static")} data-active={mode === "static"} className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground flex items-center gap-1.5"><Database className="w-3 h-3" /> Static</button>
        <button onClick={() => flipMode("live")} data-active={mode === "live"} className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground flex items-center gap-1.5"><Radio className="w-3 h-3" /> Live</button>
        <div className="ml-auto text-xs text-muted-foreground self-center">Active dataset: <b>{asOf}</b> ({source})</div>
      </div>

      {mode === "live" && (
        <div className="mb-4">
          <label className="text-xs uppercase text-muted-foreground font-mono">Live data endpoint</label>
          <div className="mt-1 flex gap-2">
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://your-broker-proxy.example.com"
              className="flex-1 px-3 py-2 rounded border border-border bg-background/40 text-sm font-mono outline-none" />
            <button onClick={saveEndpoint} className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold">Save</button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Provider must expose <code>/quote?symbol=…</code> and <code>/historical?symbol=…&range=…</code>. Leave empty to fall back to static.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        {([
          { kind: "stocks" as const, label: "Stocks CSV/JSON", ref: stockRef },
          { kind: "funds" as const, label: "Mutual funds CSV/JSON", ref: fundRef },
          { kind: "etfs" as const, label: "ETFs CSV/JSON", ref: etfRef },
        ]).map(({ kind, label, ref }) => (
          <div key={kind}>
            <button onClick={() => ref.current?.click()} className="w-full px-3 py-2 rounded border border-border text-sm flex items-center justify-center gap-2 hover:bg-primary/10"><Upload className="w-3 h-3" /> {label}</button>
            <input ref={ref} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); e.currentTarget.value = ""; }} />
          </div>
        ))}
      </div>

      <button onClick={reset} className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground"><RotateCcw className="w-3 h-3" /> Revert to bundled dataset</button>

      {msg && (
        <div className="mt-3 text-sm flex items-center gap-2" style={{ color: msg.ok ? "#00ff88" : "#ff4466" }}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Upload must match the bundled JSON schema (or the same headers as the Value Research / NSE exports). No automated scraping — Screener.in has no public API and their terms prohibit it.</p>
    </div>
  );
}

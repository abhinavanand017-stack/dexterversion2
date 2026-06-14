import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, ChevronDown } from "lucide-react";

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

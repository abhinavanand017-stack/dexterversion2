import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Receipt, AlertTriangle } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";

export const Route = createFileRoute("/tax")({
  head: () => ({ meta: [
    { title: "Tax Center — DEXTER" },
    { name: "description", content: "Capital gains estimator, tax-loss harvesting suggestions, and ELSS 80C tracker for Indian investors." },
  ] }),
  component: TaxPage,
});

// Indian FY runs Apr 1 – Mar 31
function fyEnd(): Date {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(y, 2, 31);
}
function daysToFyEnd(): number {
  return Math.max(0, Math.round((fyEnd().getTime() - Date.now()) / 86400000));
}
function fmtINR(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function TaxPage() {
  const { holdings } = usePortfolio();
  // editable tax rates so users can adjust if regulator updates
  const [stcgRate, setStcgRate] = useState(20);
  const [ltcgRate, setLtcgRate] = useState(12.5);
  const [ltcgExempt, setLtcgExempt] = useState(125000);

  // synthetic "current" prices ≈ avg cost * jitter, since we don't fetch live here
  const enriched = useMemo(() => holdings.map((h) => {
    let seed = 0; for (const c of h.symbol) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const noise = ((seed % 1000) / 1000 - 0.5) * 0.6; // -30% to +30%
    const currentPrice = h.avgCost * (1 + noise);
    const buyDate = h.buyDate ? new Date(h.buyDate) : new Date(Date.now() - 200 * 86400000);
    const isLT = (Date.now() - buyDate.getTime()) / 86400000 > 365;
    const gain = (currentPrice - h.avgCost) * h.qty;
    return { ...h, currentPrice, buyDate, isLT, gain };
  }), [holdings]);

  const stcgGain = enriched.filter((x) => !x.isLT).reduce((s, x) => s + x.gain, 0);
  const ltcgGain = enriched.filter((x) => x.isLT).reduce((s, x) => s + x.gain, 0);
  const stcgTax = Math.max(0, stcgGain) * (stcgRate / 100);
  const ltcgTaxable = Math.max(0, ltcgGain - ltcgExempt);
  const ltcgTax = ltcgTaxable * (ltcgRate / 100);
  const totalTax = stcgTax + ltcgTax;

  const losses = enriched.filter((x) => x.gain < 0).sort((a, b) => a.gain - b.gain);
  const elssInvested = holdings.filter((h) => h.category === "elss").reduce((s, h) => s + h.qty * h.avgCost, 0);
  const elssCap = 150000;
  const elssRemaining = Math.max(0, elssCap - elssInvested);
  const elssPct = Math.min(100, (elssInvested / elssCap) * 100);

  return (
    <div className="dx-fade-in space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Tax Center</h1>
        <p className="text-xs text-muted-foreground font-mono">Capital gains · 80C tracker · tax-loss harvesting — for Indian residents (FY ending {fyEnd().toLocaleDateString("en-IN")})</p>
      </header>

      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          This is an estimate for planning purposes only, not tax advice. Tax rules change — confirm with a CA before filing.
          <a href="https://www.incometax.gov.in" target="_blank" rel="noreferrer" className="ml-1 underline inline-flex items-center gap-0.5">Income Tax Portal <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>

      {/* FY countdown */}
      <div className="dx-glass p-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Days left in FY {fyEnd().getFullYear()}</div>
          <div className="text-3xl font-display dx-grad-text">{daysToFyEnd()}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <Stat label="STCG (estd)" value={fmtINR(stcgGain)} color={stcgGain >= 0 ? "var(--bull)" : "var(--bear)"} />
          <Stat label="LTCG (estd)" value={fmtINR(ltcgGain)} color={ltcgGain >= 0 ? "var(--bull)" : "var(--bear)"} />
          <Stat label="Est. Tax Liability" value={fmtINR(totalTax)} color="var(--primary)" />
        </div>
      </div>

      {/* Rates */}
      <div className="dx-glass p-4 grid sm:grid-cols-3 gap-3 text-xs">
        <Field label="STCG rate (%) — equity short-term">
          <input type="number" min={0} max={100} step={0.1} value={stcgRate} onChange={(e) => setStcgRate(Number(e.target.value))}
            className="w-full px-2 py-1.5 rounded border border-border bg-background/40 font-mono" />
        </Field>
        <Field label="LTCG rate (%) — equity long-term">
          <input type="number" min={0} max={100} step={0.1} value={ltcgRate} onChange={(e) => setLtcgRate(Number(e.target.value))}
            className="w-full px-2 py-1.5 rounded border border-border bg-background/40 font-mono" />
        </Field>
        <Field label="LTCG exempt threshold (₹)">
          <input type="number" min={0} value={ltcgExempt} onChange={(e) => setLtcgExempt(Number(e.target.value))}
            className="w-full px-2 py-1.5 rounded border border-border bg-background/40 font-mono" />
        </Field>
      </div>

      {/* 80C / ELSS tracker */}
      <div className="dx-glass p-4 space-y-2">
        <div className="flex justify-between text-xs"><span className="font-semibold">Section 80C — ELSS Investments</span><span className="font-mono">{fmtINR(elssInvested)} / {fmtINR(elssCap)}</span></div>
        <div className="h-3 rounded bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${elssPct}%` }} /></div>
        {elssRemaining > 0
          ? <p className="text-[11px] text-muted-foreground">Invest <span className="font-mono text-emerald-400">{fmtINR(elssRemaining)}</span> more in ELSS to maximize your 80C deduction.</p>
          : <p className="text-[11px] text-emerald-400">80C maxed out for this FY ✓</p>}
      </div>

      {/* Holdings breakdown */}
      <div className="dx-glass rounded-xl overflow-hidden">
        <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Receipt className="h-3 w-3" /> Capital Gains Estimator</div>
        {enriched.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Add holdings on the Portfolio page to see capital-gains estimates.</div>}
        {enriched.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-background/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Symbol</th>
                  <th className="text-right px-2 py-2">Qty</th>
                  <th className="text-right px-2 py-2">Avg ₹</th>
                  <th className="text-right px-2 py-2">Now ₹</th>
                  <th className="text-center px-2 py-2">Holding</th>
                  <th className="text-right px-2 py-2">Gain / Loss</th>
                  <th className="text-right px-2 py-2">Est. Tax</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((x) => {
                  const tax = x.gain <= 0 ? 0 : x.isLT
                    ? Math.max(0, x.gain) * (ltcgRate / 100)
                    : x.gain * (stcgRate / 100);
                  return (
                    <tr key={x.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono font-semibold">{x.symbol}</td>
                      <td className="px-2 py-2 text-right font-mono">{x.qty}</td>
                      <td className="px-2 py-2 text-right font-mono">{x.avgCost.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono">{x.currentPrice.toFixed(2)}</td>
                      <td className="px-2 py-2 text-center"><span className={"text-[10px] px-1.5 py-0.5 rounded border " + (x.isLT ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300")}>{x.isLT ? "LT" : "ST"}</span></td>
                      <td className={"px-2 py-2 text-right font-mono " + (x.gain >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtINR(x.gain)}</td>
                      <td className="px-2 py-2 text-right font-mono text-amber-300">{fmtINR(tax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground italic p-3">"Now ₹" uses an indicative price; replace with live price on the Portfolio page for real numbers. STCG = held ≤ 12 months for listed equity.</p>
      </div>

      {/* Tax loss harvesting */}
      {losses.length > 0 && (
        <div className="dx-glass p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Tax-Loss Harvesting Suggestions</h2>
            <span className="dx-pill">{daysToFyEnd()}d left in FY</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Selling at a loss can offset realized gains for the FY. Consider harvesting these before {fyEnd().toLocaleDateString("en-IN")}:</p>
          <div className="space-y-1">
            {losses.slice(0, 6).map((x) => (
              <div key={x.id} className="flex justify-between text-xs border-t border-border py-1.5">
                <span className="font-mono">{x.symbol}</span>
                <span className="text-red-400 font-mono">{fmtINR(x.gain)}</span>
                <span className="text-[10px] text-muted-foreground">Could offset ~{fmtINR(Math.abs(x.gain) * (x.isLT ? ltcgRate : stcgRate) / 100)} in tax</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

void useEffect;

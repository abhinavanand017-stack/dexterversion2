import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatINR";
import { GraduationCap, BookOpen, Trophy, TrendingUp, Brain, Shield, Sparkles } from "lucide-react";

/* ============================================================
   Investment Masterclass
   Learn how legendary investors think, allocate, and compound.
   All figures are illustrative and clearly labelled as such.
   ============================================================ */

interface Investor {
  id: string;
  name: string;
  tagline: string;
  era: string;
  style: string;
  cagr: number;           // reported/illustrative long-run CAGR %
  color: string;
  quote: string;
  principles: string[];
  allocation: Array<{ name: string; value: number; color: string }>;
  checklist: string[];
  book: string;
}

const INVESTORS: Investor[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    tagline: "The Oracle of Omaha",
    era: "1965–present · Berkshire Hathaway",
    style: "Concentrated quality value · long-hold",
    cagr: 19.8,
    color: "#00d4ff",
    quote: "Price is what you pay. Value is what you get.",
    principles: [
      "Buy wonderful businesses at fair prices — not fair businesses at wonderful prices",
      "Circle of competence: only own what you understand",
      "Moat matters — brand, cost, network, switching",
      "Time is the friend of a great business, enemy of a mediocre one",
      "Be fearful when others are greedy, greedy when others are fearful",
    ],
    allocation: [
      { name: "Consumer Brands (KO, KHC)", value: 22, color: "#00d4ff" },
      { name: "Financials (BAC, AXP)", value: 24, color: "#a78bfa" },
      { name: "Tech (AAPL)", value: 30, color: "#00ff88" },
      { name: "Energy & Utilities", value: 12, color: "#ffaa00" },
      { name: "Cash & Bonds", value: 12, color: "#94a3b8" },
    ],
    checklist: [
      "Does the CEO think & write like an owner?",
      "Is ROE > 15% for 10+ years without heavy debt?",
      "Can I understand the product with a paragraph?",
      "Would I be happy if the market shut for 5 years?",
    ],
    book: "The Essays of Warren Buffett — Lawrence Cunningham",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    tagline: "The Story Investor",
    era: "1977–1990 · Fidelity Magellan",
    style: "GARP · scuttlebutt · retail edge",
    cagr: 29.2,
    color: "#00ff88",
    quote: "Know what you own, and know why you own it.",
    principles: [
      "Invest in what you know — your job, your mall, your family",
      "Look for tenbaggers hiding in boring names",
      "PEG < 1 = usually cheap for the growth",
      "Categorise: Stalwart, Fast-Grower, Cyclical, Turnaround, Asset Play",
      "The person who turns over the most rocks wins",
    ],
    allocation: [
      { name: "Fast-Growers (20-25% EPS g)", value: 35, color: "#00ff88" },
      { name: "Stalwarts (Compounders)", value: 25, color: "#00d4ff" },
      { name: "Cyclicals (Auto, Metals)", value: 15, color: "#ffaa00" },
      { name: "Turnarounds", value: 15, color: "#a78bfa" },
      { name: "Asset Plays (Real Estate)", value: 10, color: "#94a3b8" },
    ],
    checklist: [
      "Can I explain the business in 2 minutes?",
      "Is PEG ratio below 1?",
      "Is insider buying > insider selling?",
      "Is it boring / disliked / spun-off? (edge!)",
    ],
    book: "One Up on Wall Street — Peter Lynch",
  },
  {
    id: "graham",
    name: "Benjamin Graham",
    tagline: "Father of Value Investing",
    era: "1928–1956 · Graham-Newman",
    style: "Deep value · Mr. Market · margin of safety",
    cagr: 17.0,
    color: "#a78bfa",
    quote: "The intelligent investor is a realist who sells to optimists and buys from pessimists.",
    principles: [
      "Margin of safety is the central concept of investment",
      "Mr. Market is your servant, not your guide",
      "P/E < 15, P/B < 1.5, current ratio > 2, positive earnings 10y",
      "Diversify across 20-30 statistically cheap names",
      "Investment vs speculation: promise of safety of principal + adequate return",
    ],
    allocation: [
      { name: "Net-Net Bargains (P/B < 0.66)", value: 30, color: "#a78bfa" },
      { name: "Defensive Blue Chips", value: 30, color: "#00d4ff" },
      { name: "High-Grade Bonds", value: 30, color: "#94a3b8" },
      { name: "Cash Reserve", value: 10, color: "#ffaa00" },
    ],
    checklist: [
      "Is P/E × P/B < 22.5?",
      "Current ratio > 2 and long-term debt < working capital?",
      "10+ years of positive earnings and dividends?",
      "Am I buying with a 33% or more discount to intrinsic value?",
    ],
    book: "The Intelligent Investor — Benjamin Graham",
  },
  {
    id: "jhunjhunwala",
    name: "Rakesh Jhunjhunwala",
    tagline: "India's Big Bull",
    era: "1985–2022 · Rare Enterprises",
    style: "India growth · concentrated conviction",
    cagr: 32.0,
    color: "#ffaa00",
    quote: "Markets are like women — always commanding, mysterious, unpredictable and volatile.",
    principles: [
      "Bet big on India's structural growth story",
      "Concentrate — a handful of great ideas beat 100 mediocre ones",
      "Look for opportunity where others see chaos",
      "Trend is your friend, but valuation is your discipline",
      "Patience compounds — Titan held for 20+ years",
    ],
    allocation: [
      { name: "Titan (multi-decade compounder)", value: 32, color: "#ffaa00" },
      { name: "Banks & Financials", value: 22, color: "#00d4ff" },
      { name: "Consumer & Auto", value: 18, color: "#00ff88" },
      { name: "PSU / Turnarounds", value: 15, color: "#a78bfa" },
      { name: "Cash & Trading Book", value: 13, color: "#94a3b8" },
    ],
    checklist: [
      "Is this business a proxy for India's per-capita income growth?",
      "Is management honest, capable, and hungry?",
      "Am I willing to hold this for 10+ years?",
      "Is the position size big enough to matter if I'm right?",
    ],
    book: "The Big Bull of Dalal Street — Neil Borate",
  },
  {
    id: "munger",
    name: "Charlie Munger",
    tagline: "The Abominable No-Man",
    era: "1962–2023 · Berkshire Vice-Chair",
    style: "Mental models · latticework · quality",
    cagr: 19.8,
    color: "#00ff88",
    quote: "Invert, always invert. It's remarkable how much long-term advantage we've gotten by trying to be consistently not stupid.",
    principles: [
      "A great business at fair price > fair business at great price",
      "Use latticework of mental models across disciplines",
      "Invert: figure out how to fail, then don't do that",
      "Sit on your ass investing — inaction is often the best action",
      "Avoid envy, resentment, and ideology — poison for compounding",
    ],
    allocation: [
      { name: "Costco (30-year hold)", value: 40, color: "#00ff88" },
      { name: "Berkshire Hathaway", value: 30, color: "#00d4ff" },
      { name: "China Compounders (BABA legacy)", value: 15, color: "#ffaa00" },
      { name: "Cash / T-Bills", value: 15, color: "#94a3b8" },
    ],
    checklist: [
      "What mental model applies here? (2nd order effects, incentives, scale)",
      "If I invert — how does this go to zero?",
      "Would sitting still for 10 years be OK?",
      "Am I paying for quality, not just cheapness?",
    ],
    book: "Poor Charlie's Almanack — Peter Kaufman (ed.)",
  },
  {
    id: "dalio",
    name: "Ray Dalio",
    tagline: "Principles-Based Macro",
    era: "1975–present · Bridgewater Associates",
    style: "All-weather · risk parity · macro",
    cagr: 12.0,
    color: "#00d4ff",
    quote: "He who lives by the crystal ball is destined to eat ground glass.",
    principles: [
      "Diversify across uncorrelated return streams — the Holy Grail is 15+",
      "All-weather: balance across growth ↑↓ and inflation ↑↓",
      "Radical transparency — write down your principles and stress-test",
      "Pain + Reflection = Progress",
      "Understand economic machine: productivity + short/long debt cycles",
    ],
    allocation: [
      { name: "Long-term Bonds", value: 40, color: "#00d4ff" },
      { name: "Stocks (global)", value: 30, color: "#00ff88" },
      { name: "Intermediate Bonds", value: 15, color: "#a78bfa" },
      { name: "Gold", value: 7.5, color: "#ffaa00" },
      { name: "Commodities", value: 7.5, color: "#94a3b8" },
    ],
    checklist: [
      "Am I diversified across at least 4 asset classes?",
      "Is any single bet > 15% of portfolio?",
      "Have I written down WHY I made this trade?",
      "What macro regime am I positioned for — and what if I'm wrong?",
    ],
    book: "Principles — Ray Dalio",
  },
];

/* ============================================================
   Compounding sandbox — feel the power of time
   ============================================================ */
function buildCompoundSeries(startAmt: number, sipMonthly: number, cagr: number, years: number) {
  const data: Array<{ year: number; value: number; invested: number }> = [];
  let value = startAmt;
  let invested = startAmt;
  const monthlyRate = Math.pow(1 + cagr / 100, 1 / 12) - 1;
  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      for (let m = 0; m < 12; m++) {
        value = value * (1 + monthlyRate) + sipMonthly;
        invested += sipMonthly;
      }
    }
    data.push({ year: y, value: Math.round(value), invested: Math.round(invested) });
  }
  return data;
}

/* ============================================================
   Main component
   ============================================================ */
export function InvestmentMasterclass() {
  const [activeId, setActiveId] = useState<string>("buffett");
  const active = INVESTORS.find((i) => i.id === activeId)!;
  const [tab, setTab] = useState<"philosophy" | "portfolio" | "sandbox" | "quiz">("philosophy");

  // Compounding sandbox controls
  const [startAmt, setStartAmt] = useState(500_000);
  const [sip, setSip] = useState(25_000);
  const [years, setYears] = useState(20);
  const series = useMemo(
    () => buildCompoundSeries(startAmt, sip, active.cagr, years),
    [startAmt, sip, active.cagr, years],
  );
  const final = series[series.length - 1];

  return (
    <div className="space-y-4 dx-fade-in">
      {/* Hero */}
      <div className="dx-glass p-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle at 20% 30%, ${active.color}44, transparent 60%)` }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: `${active.color}22`, border: `1px solid ${active.color}` }}
            >
              <GraduationCap className="w-6 h-6" style={{ color: active.color }} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Investment Masterclass</div>
              <h1 className="font-display text-2xl">Learn from the Legends</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Study how the world's greatest investors think, allocate, and compound wealth.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              <TrendingUp className="w-3 h-3 mr-1" /> {active.cagr}% CAGR
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">{active.era.split(" · ")[0]}</Badge>
          </div>
        </div>
      </div>

      {/* Investor selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {INVESTORS.map((inv) => {
          const isActive = inv.id === activeId;
          return (
            <button
              key={inv.id}
              onClick={() => setActiveId(inv.id)}
              className="p-3 rounded-lg text-left transition relative overflow-hidden"
              style={{
                background: isActive ? `${inv.color}18` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? inv.color : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <div className="text-xs font-semibold" style={{ color: isActive ? inv.color : "#e2e8f0" }}>
                {inv.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{inv.tagline}</div>
              <div className="text-[10px] font-mono mt-1" style={{ color: inv.color }}>
                {inv.cagr}% CAGR
              </div>
            </button>
          );
        })}
      </div>

      {/* Quote card */}
      <div
        className="dx-glass p-5 border-l-4 italic text-sm"
        style={{ borderColor: active.color }}
      >
        <Sparkles className="inline w-4 h-4 mr-2" style={{ color: active.color }} />
        "{active.quote}"
        <div className="not-italic text-[11px] text-muted-foreground mt-2">— {active.name} · {active.style}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          ["philosophy", "Philosophy", BookOpen],
          ["portfolio", "Portfolio Blueprint", Shield],
          ["sandbox", "Compounding Sandbox", TrendingUp],
          ["quiz", "Investor Checklist", Brain],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "philosophy" && (
        <div className="dx-glass p-5 space-y-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5" style={{ color: active.color }} />
            Core Principles of {active.name}
          </h2>
          <ol className="space-y-2">
            {active.principles.map((p, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg bg-background/40 border border-border/40">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                  style={{ background: `${active.color}22`, color: active.color, border: `1px solid ${active.color}66` }}
                >
                  {i + 1}
                </span>
                <span className="text-sm">{p}</span>
              </li>
            ))}
          </ol>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs mt-4">
            📚 <span className="font-semibold">Recommended read:</span> {active.book}
          </div>
        </div>
      )}

      {tab === "portfolio" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="dx-glass p-5">
            <h3 className="font-display text-lg mb-1">Illustrative Allocation</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              A stylised portrait of how {active.name.split(" ")[0]} tends to allocate. Not live holdings — for learning only.
            </p>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={active.allocation} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                    {active.allocation.map((a, i) => <Cell key={i} fill={a.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}
                    formatter={(v: number) => `${v}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dx-glass p-5">
            <h3 className="font-display text-lg mb-3">Position Breakdown</h3>
            <div className="space-y-2">
              {active.allocation.map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <div className="flex-1 text-xs">{a.name}</div>
                  <div className="font-mono text-xs" style={{ color: a.color }}>{a.value}%</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-background/40 border border-border/40 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Why this shape?</strong> {active.style}. The mix reflects the risk-return trade-off {active.name.split(" ")[0]} accepts to compound over decades.
            </div>
          </div>
        </div>
      )}

      {tab === "sandbox" && (
        <div className="dx-glass p-5 space-y-4">
          <div>
            <h3 className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: active.color }} />
              Compounding Sandbox — {active.name}'s pace
            </h3>
            <p className="text-xs text-muted-foreground">
              What happens if you invest like {active.name.split(" ")[0]} — {active.cagr}% CAGR — for {years} years?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SandboxNumber label="Starting Corpus" value={startAmt} onChange={setStartAmt} min={0} max={10_000_000} step={50_000} />
            <SandboxNumber label="Monthly SIP" value={sip} onChange={setSip} min={0} max={200_000} step={5_000} />
            <SandboxNumber label="Years" value={years} onChange={setYears} min={1} max={40} step={1} suffix="yr" />
          </div>

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `Y${v}`} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e5).toFixed(0)}L`} />
                <Tooltip
                  contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}
                  formatter={(v: number, k) => [formatINR(v, { compact: true }), k]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="invested" name="You Invested" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="value" name={`Portfolio @ ${active.cagr}%`} stroke={active.color} strokeWidth={2.5} dot={false} animationDuration={1200} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SandboxStat label="You Invested" value={formatINR(final.invested, { compact: true })} color="#94a3b8" />
            <SandboxStat label="Final Value" value={formatINR(final.value, { compact: true })} color={active.color} />
            <SandboxStat
              label="Wealth Multiple"
              value={`${(final.value / Math.max(1, final.invested)).toFixed(2)}×`}
              color="#00ff88"
            />
          </div>

          <div className="text-[11px] text-muted-foreground italic">
            💡 Historical returns are not guaranteed. This sandbox is a teaching aid — real markets have drawdowns of 30–50% along the way. Legends earn their CAGR by surviving those.
          </div>
        </div>
      )}

      {tab === "quiz" && (
        <div className="dx-glass p-5 space-y-4">
          <h3 className="font-display text-lg flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: active.color }} />
            {active.name}'s Pre-Buy Checklist
          </h3>
          <p className="text-xs text-muted-foreground">
            Before you click Buy, mentally answer these — the way {active.name.split(" ")[0]} would.
          </p>
          <ChecklistWidget items={active.checklist} color={active.color} />
        </div>
      )}

      {/* Footer CTA */}
      <div className="dx-glass p-4 flex items-center gap-3 flex-wrap">
        <Trophy className="w-5 h-5 text-amber-400" />
        <div className="text-xs flex-1">
          Rotate through all {INVESTORS.length} masters this week — spend 10 minutes per legend. Compounding your knowledge is the highest ROI trade of all.
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          const idx = INVESTORS.findIndex((i) => i.id === activeId);
          setActiveId(INVESTORS[(idx + 1) % INVESTORS.length].id);
          setTab("philosophy");
        }}>Next Legend →</Button>
      </div>
    </div>
  );
}

function SandboxNumber({
  label, value, onChange, min, max, step, suffix,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string; }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="font-mono text-xs w-24 text-right">
          {suffix ? `${value}${suffix}` : formatINR(value, { compact: true })}
        </span>
      </div>
    </label>
  );
}

function SandboxStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="dx-glass p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-base md:text-lg mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function ChecklistWidget({ items, color }: { items: string[]; color: string }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const pct = Math.round((checked.size / items.length) * 100);
  return (
    <div className="space-y-2">
      <div className="h-2 bg-background/40 rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[11px] text-muted-foreground font-mono">Conviction: {pct}%</div>
      {items.map((q, i) => {
        const on = checked.has(i);
        return (
          <button
            key={i}
            onClick={() => setChecked((prev) => {
              const n = new Set(prev);
              if (n.has(i)) n.delete(i); else n.add(i);
              return n;
            })}
            className="w-full text-left p-3 rounded-lg border transition flex items-start gap-3"
            style={{
              borderColor: on ? color : "rgba(255,255,255,0.1)",
              background: on ? `${color}12` : "transparent",
            }}
          >
            <span
              className="w-5 h-5 rounded shrink-0 flex items-center justify-center text-[11px] font-bold"
              style={{ background: on ? color : "transparent", border: `1px solid ${color}88`, color: on ? "#0d1117" : color }}
            >
              {on ? "✓" : i + 1}
            </span>
            <span className="text-sm">{q}</span>
          </button>
        );
      })}
      {pct === 100 && (
        <div className="p-3 rounded-lg text-xs" style={{ background: `${color}18`, border: `1px solid ${color}` }}>
          🎯 Full conviction. If every answer is a genuine "yes", this is the kind of trade a legend would take.
        </div>
      )}
    </div>
  );
}

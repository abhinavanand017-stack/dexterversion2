import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { INVESTORS, INVESTORS_BY_SLUG } from "@/lib/masterclass/investors";
import { BOOKS } from "@/lib/masterclass/books";
import { PLAYBOOKS } from "@/lib/masterclass/playbooks";
import { HERO_QUOTES } from "@/lib/masterclass/quotes";
import type { Investor, Category } from "@/lib/masterclass/types";
import { CompoundingSandbox } from "./CompoundingSandbox";
import { InvestorChecklist } from "./InvestorChecklist";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { GraduationCap, BookOpen, Sparkles, Users, ExternalLink, ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

const TABS = [
  { id: "legends", label: "Legends", icon: GraduationCap },
  { id: "reading", label: "Reading Room", icon: BookOpen },
  { id: "playbooks", label: "Playbooks", icon: Sparkles },
  { id: "matcher", label: "Style Matcher", icon: Users },
  { id: "compare", label: "Compare", icon: Users },
] as const;
type TabId = typeof TABS[number]["id"];

const CATEGORIES: Array<"All" | Category> = ["All","Value","Growth","Macro","Quant","Activist","Contrarian","Trend","India"];

const PIE_COLORS = ["#00d4ff","#a78bfa","#00ff88","#ffaa00","#ff6b6b","#94a3b8","#38bdf8"];

function Monogram({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return (
    <div
      className={`flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 25%), hsl(${(hue + 40) % 360} 70% 40%))` }}
    >
      {initials}
    </div>
  );
}

export function MasterclassPage() {
  const [tab, setTab] = useState<TabId>("legends");
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQuoteIdx((i) => (i + 1) % HERO_QUOTES.length), 8000);
    return () => clearInterval(t);
  }, []);
  const q = HERO_QUOTES[quoteIdx];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary/80 mb-2">
            <GraduationCap className="h-4 w-4" /> Investment Masterclass
          </div>
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">Learn how the world's greatest investors think.</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            50 legends. 30 books. 8 playbooks. One quiz to find your style. Educational content only — not investment advice.
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-card/30 px-4 py-3 text-sm">
            <span className="italic">"{q.text}"</span>{" "}
            <span className="text-muted-foreground">— {q.author}{!q.verified && " (attributed)"}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/60 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 whitespace-nowrap transition ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {tab === "legends" && <LegendsTab />}
        {tab === "reading" && <ReadingRoom />}
        {tab === "playbooks" && <PlaybooksTab />}
        {tab === "matcher" && <StyleMatcher />}
        {tab === "compare" && <CompareTab />}
      </div>
    </div>
  );
}

/* ============ LEGENDS ============ */
function LegendsTab() {
  const [cat, setCat] = useState<"All" | Category>("All");
  const [search, setSearch] = useState("");
  const [era, setEra] = useState(1900);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const list = useMemo(() => INVESTORS.filter((i) => {
    if (cat !== "All" && !i.categories.includes(cat)) return false;
    if (i.eraStart < era) return false;
    if (search && !(i.name + i.epithet + i.primary).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [cat, search, era]);

  if (selectedSlug) {
    const inv = INVESTORS_BY_SLUG[selectedSlug];
    if (!inv) return null;
    return <InvestorDetail investor={inv} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">Educational content only — not investment advice.</div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              cat === c ? "bg-primary/20 border-primary text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}>{c}</button>
        ))}
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search legends..."
          className="bg-card/40 border border-border/60 rounded px-3 py-2 text-sm flex-1" />
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Era from <span className="font-mono text-foreground">{era}s</span>
          <input type="range" min={1900} max={2020} step={10} value={era} onChange={(e) => setEra(+e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((inv) => (
          <button key={inv.slug} onClick={() => setSelectedSlug(inv.slug)}
            className="text-left rounded-lg border border-border/60 bg-card/40 p-4 hover:border-primary/60 hover:bg-card/60 transition group">
            <div className="flex items-start gap-3">
              <Monogram name={inv.name} className="h-12 w-12 rounded-md text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{inv.flag}</span><span className="truncate">{inv.country}</span>
                </div>
                <div className="font-semibold truncate group-hover:text-primary">{inv.name}</div>
                <div className="text-xs text-muted-foreground truncate">{inv.epithet}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{inv.primary}</span>
              <span className="font-mono text-muted-foreground truncate ml-2">~{inv.cagrNum}%</span>
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-8 text-center">No legends match those filters.</div>}
      </div>
    </div>
  );
}

function InvestorDetail({ investor, onBack }: { investor: Investor; onBack: () => void }) {
  const books = investor.bookSlugs.map((s) => BOOKS.find((b) => b.slug === s)).filter(Boolean);
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Legends
      </button>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <Monogram name={investor.name} className="h-20 w-20 rounded-lg text-xl" />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">{investor.flag} {investor.country} · {investor.era}</div>
          <h2 className="text-2xl font-semibold">{investor.name}</h2>
          <div className="text-sm text-muted-foreground">{investor.epithet}</div>
          <p className="text-sm mt-2 max-w-3xl">{investor.bio}</p>
          <div className="mt-2 text-xs font-mono text-primary/80">{investor.cagr}</div>
          <div className="mt-3 rounded border border-border/60 bg-card/40 px-3 py-2 text-sm italic">
            "{investor.quote}" <span className="not-italic text-xs text-muted-foreground ml-1">— {investor.name}{!investor.quoteVerified && " (attributed)"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Core Principles</h3>
          <ol className="space-y-1.5 text-sm list-decimal list-inside">
            {investor.principles.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">What they avoid</h4>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {investor.avoids.map((a, i) => <li key={i}>× {a}</li>)}
          </ul>
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Portfolio Blueprint</h3>
          <div className="text-xs text-muted-foreground mb-2">Hold: {investor.holdingPeriod} · {investor.concentration}</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={investor.allocation} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                  {investor.allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="text-xs space-y-0.5">
            {investor.allocation.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="font-mono text-muted-foreground">{a.value}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Signature Framework</h3>
          <div className="font-medium">{investor.framework.name}</div>
          <p className="text-sm text-muted-foreground mt-1">{investor.framework.detail}</p>
          {investor.framework.items && (
            <ul className="mt-3 space-y-1 text-sm">
              {investor.framework.items.map((it, i) => (
                <li key={i} className="flex gap-2"><span className="text-primary">◆</span> {it}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold mb-1 uppercase tracking-wider text-muted-foreground">A Real Decision</h3>
          <p className="text-sm">{investor.caseStudy}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><div className="text-muted-foreground">Strength</div><div>{investor.strength}</div></div>
            <div><div className="text-muted-foreground">Blind spot</div><div>{investor.blindspot}</div></div>
          </div>
        </section>

        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CompoundingSandbox defaultCAGR={investor.cagrNum || 12} label={investor.name} />
          <InvestorChecklist storageKey={investor.slug} items={[...investor.principles, ...(investor.framework.items || [])]} />
        </div>

        {books.length > 0 && (
          <section className="lg:col-span-2 rounded-lg border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Recommended Reading</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {books.map((b) => b && (
                <div key={b.slug} className="text-sm flex items-start gap-2 rounded border border-border/40 p-2">
                  <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div><div className="font-medium">{b.title}</div><div className="text-xs text-muted-foreground">{b.author} — {b.takeaway}</div></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ============ READING ROOM ============ */
function ReadingRoom() {
  const [tag, setTag] = useState<string>("All");
  const [list, setList] = useLocalStorage<Record<string, boolean>>("dx_mc_reading_list", {});
  const tags = useMemo(() => ["All", ...Array.from(new Set(BOOKS.flatMap((b) => b.tags)))], []);
  const core = BOOKS.filter((b) => b.shelf === "core" && (tag === "All" || b.tags.includes(tag)));
  const india = BOOKS.filter((b) => b.shelf === "india" && (tag === "All" || b.tags.includes(tag)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(t)}
            className={`px-3 py-1 rounded-full text-xs border ${tag === t ? "bg-primary/20 border-primary text-primary" : "border-border/60 text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <BookGrid books={core} list={list} setList={setList} />
      {india.length > 0 && (<>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-4">India Shelf</div>
        <BookGrid books={india} list={list} setList={setList} />
      </>)}
    </div>
  );
}

function BookGrid({ books, list, setList }: { books: typeof BOOKS; list: Record<string, boolean>; setList: (v: Record<string, boolean>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {books.map((b) => {
        const saved = !!list[b.slug];
        return (
          <div key={b.slug} className="rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <Monogram name={b.title} className="h-14 w-10 rounded text-xs" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm leading-snug">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.author}</div>
              </div>
              <button onClick={() => setList({ ...list, [b.slug]: !saved })}
                className={`p-1.5 rounded hover:bg-muted/40 ${saved ? "text-primary" : "text-muted-foreground"}`} title="Reading list">
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{b.takeaway}</div>
            <div className="flex flex-wrap gap-1">
              {b.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40">{t}</span>)}
            </div>
            {b.investors.length > 0 && (
              <div className="text-[10px] text-muted-foreground">Linked: {b.investors.slice(0, 3).map((s) => INVESTORS_BY_SLUG[s]?.name).filter(Boolean).join(", ")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============ PLAYBOOKS ============ */
function PlaybooksTab() {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Interactive teaching layer. Execute the ideas in the linked Dexter tools.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLAYBOOKS.map((p) => <PlaybookCard key={p.slug} pb={p} />)}
      </div>
    </div>
  );
}

function PlaybookCard({ pb }: { pb: typeof PLAYBOOKS[number] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-primary/80">{pb.sourceInvestors.map((s) => INVESTORS_BY_SLUG[s]?.name.split(" ").pop()).filter(Boolean).join(" · ")}</div>
        <h3 className="font-semibold">{pb.title}</h3>
        <p className="text-sm text-muted-foreground">{pb.description}</p>
      </div>
      <PlaybookInteractive kind={pb.kind} slug={pb.slug} />
      {pb.linkTool && (
        <Link to={pb.linkTool.href as never} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Try on live NSE data <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function PlaybookInteractive({ kind, slug }: { kind: typeof PLAYBOOKS[number]["kind"]; slug: string }) {
  const [state, setState] = useLocalStorage<Record<string, number>>(`dx_mc_pb_${slug}`, {});
  const set = (k: string, v: number) => setState({ ...state, [k]: v });

  if (kind === "moatChecklist") {
    const moats = ["Brand", "Cost advantage", "Network effect", "Switching cost", "Regulatory"];
    const total = moats.reduce((a, m) => a + (state[m] || 0), 0);
    return (
      <div className="space-y-2">
        {moats.map((m) => (
          <div key={m} className="flex items-center gap-3 text-sm">
            <span className="w-32 text-muted-foreground">{m}</span>
            <input type="range" min={0} max={5} value={state[m] || 0} onChange={(e) => set(m, +e.target.value)} className="flex-1" />
            <span className="font-mono w-6 text-right">{state[m] || 0}</span>
          </div>
        ))}
        <div className="text-xs font-mono text-primary">Moat score: {total}/25</div>
      </div>
    );
  }
  if (kind === "marginOfSafety") {
    const iv = state.iv || 1000;
    const price = state.price || 800;
    const mos = iv > 0 ? ((iv - price) / iv) * 100 : 0;
    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="space-y-1"><div className="text-xs text-muted-foreground">Intrinsic value ₹</div>
          <input type="number" value={iv} onChange={(e) => set("iv", +e.target.value)} className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" /></label>
        <label className="space-y-1"><div className="text-xs text-muted-foreground">Current price ₹</div>
          <input type="number" value={price} onChange={(e) => set("price", +e.target.value)} className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" /></label>
        <div className="col-span-2 text-sm">Margin of safety: <span className={`font-mono ${mos >= 30 ? "text-emerald-400" : mos >= 0 ? "text-amber-400" : "text-red-400"}`}>{mos.toFixed(1)}%</span> {mos >= 30 && "· buy zone"}</div>
      </div>
    );
  }
  if (kind === "qglp" || kind === "smile" || kind === "compounderScore") {
    const axes = kind === "qglp" ? ["Quality","Growth","Longevity","Price"]
      : kind === "smile" ? ["Small size","Medium experience","Large aspiration","XL market"]
      : ["ROCE","Growth consistency","Promoter integrity","Cash flow"];
    const total = axes.reduce((a, m) => a + (state[m] || 0), 0);
    return (
      <div className="space-y-2">
        {axes.map((a) => (
          <div key={a} className="flex items-center gap-3 text-sm">
            <span className="w-40 text-muted-foreground">{a}</span>
            <input type="range" min={0} max={10} value={state[a] || 0} onChange={(e) => set(a, +e.target.value)} className="flex-1" />
            <span className="font-mono w-8 text-right">{state[a] || 0}</span>
          </div>
        ))}
        <div className="text-xs font-mono text-primary">Score: {total}/{axes.length * 10}</div>
      </div>
    );
  }
  if (kind === "positionSizing") {
    const p = (state.p || 60) / 100;
    const b = state.b || 2;
    const kelly = b > 0 ? Math.max(0, ((b * p - (1 - p)) / b) * 100) : 0;
    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="space-y-1"><div className="text-xs text-muted-foreground">Win prob %</div>
          <input type="number" min={1} max={99} value={state.p || 60} onChange={(e) => set("p", +e.target.value)} className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" /></label>
        <label className="space-y-1"><div className="text-xs text-muted-foreground">Payoff ratio (b)</div>
          <input type="number" min={0.1} step={0.1} value={state.b || 2} onChange={(e) => set("b", +e.target.value)} className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" /></label>
        <div className="col-span-2 text-sm">Kelly bet: <span className="font-mono text-primary">{kelly.toFixed(1)}%</span> · half-Kelly (safer): <span className="font-mono">{(kelly/2).toFixed(1)}%</span></div>
        <div className="col-span-2 text-xs text-muted-foreground">Never bet the farm — even elite traders halve Kelly.</div>
      </div>
    );
  }
  if (kind === "cycleGauge") {
    const axes = ["Valuations","Sentiment","Credit ease","IPO froth"];
    const total = axes.reduce((a, m) => a + (state[m] || 5), 0);
    const temp = Math.round((total / (axes.length * 10)) * 10);
    return (
      <div className="space-y-2">
        {axes.map((a) => (
          <div key={a} className="flex items-center gap-3 text-sm">
            <span className="w-32 text-muted-foreground">{a}</span>
            <input type="range" min={0} max={10} value={state[a] ?? 5} onChange={(e) => set(a, +e.target.value)} className="flex-1" />
            <span className="font-mono w-8 text-right">{state[a] ?? 5}</span>
          </div>
        ))}
        <div className="text-xs">Cycle temperature: <span className={`font-mono ${temp >= 8 ? "text-red-400" : temp >= 5 ? "text-amber-400" : "text-emerald-400"}`}>{temp}/10</span></div>
      </div>
    );
  }
  // behavioralGuardrail
  const items = ["I'm not chasing a recent move","I've defined my exit","I'd size the same after -30%","I've sought a disconfirming view","I'm sober, rested, unemotional"];
  const done = items.filter((it) => state[it]).length;
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <button key={it} onClick={() => set(it, state[it] ? 0 : 1)}
          className="flex items-start gap-2 text-left text-sm w-full text-muted-foreground hover:text-foreground">
          <span className={`h-4 w-4 rounded border shrink-0 mt-0.5 ${state[it] ? "bg-emerald-500/20 border-emerald-500" : "border-border/60"}`} />
          <span className={state[it] ? "line-through opacity-60" : ""}>{it}</span>
        </button>
      ))}
      <div className="text-xs font-mono text-primary">{done}/{items.length} guardrails clear</div>
    </div>
  );
}

/* ============ STYLE MATCHER ============ */
const QUIZ = [
  { q: "Your time horizon?", opts: [
    { t: "Months", tags: ["Trend","Macro"] }, { t: "1–3 years", tags: ["Contrarian","Value"] },
    { t: "5+ years", tags: ["Growth","Value","India"] }, { t: "Decades", tags: ["Value","Passive"] }] },
  { q: "Reaction to a −30% drawdown?", opts: [
    { t: "Sell", tags: ["Passive"] }, { t: "Hold", tags: ["Value","Growth"] },
    { t: "Buy more", tags: ["Value","Contrarian"] }, { t: "Panic", tags: ["Behavioral"] }] },
  { q: "Preferred edge?", opts: [
    { t: "Deep research", tags: ["Value"] }, { t: "Macro trends", tags: ["Macro"] },
    { t: "Quant / data", tags: ["Quant"] }, { t: "Patience", tags: ["Value","Growth"] }] },
  { q: "Concentration comfort?", opts: [
    { t: "1–3 stocks", tags: ["Activist","Value"] }, { t: "5–10", tags: ["Value","Growth"] },
    { t: "15–30", tags: ["Growth","India"] }, { t: "Index-like", tags: ["Passive"] }] },
  { q: "Geography?", opts: [
    { t: "India-focused", tags: ["India"] }, { t: "Global", tags: ["Value","Macro"] },
    { t: "Both", tags: ["India","Value"] }, { t: "Emerging markets", tags: ["Contrarian"] }] },
  { q: "What excites you most?", opts: [
    { t: "Hidden gems", tags: ["India","Growth"] }, { t: "Macro calls", tags: ["Macro"] },
    { t: "Mathematical edges", tags: ["Quant"] }, { t: "Own great businesses forever", tags: ["Value","Growth"] }] },
];

function StyleMatcher() {
  const [answers, setAnswers] = useLocalStorage<number[]>("dx_mc_quiz", []);
  const [step, setStep] = useState(0);
  const done = answers.length === QUIZ.length;

  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    answers.forEach((a, i) => {
      const opt = QUIZ[i]?.opts[a];
      opt?.tags.forEach((t) => (s[t] = (s[t] || 0) + 1));
    });
    return s;
  }, [answers]);

  const matches = useMemo(() => {
    return [...INVESTORS].map((i) => ({
      inv: i,
      score: i.categories.reduce((acc, c) => acc + (scores[c] || 0), 0),
    })).sort((a, b) => b.score - a.score).slice(0, 3);
  }, [scores]);

  const restart = () => { setAnswers([]); setStep(0); };

  if (done) {
    const top = matches[0];
    const books = top.inv.bookSlugs.slice(0, 2).map((s) => BOOKS.find((b) => b.slug === s)).filter(Boolean);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-6">
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Your closest match</div>
          <div className="flex items-center gap-4 mt-2">
            <Monogram name={top.inv.name} className="h-16 w-16 rounded-lg text-lg" />
            <div>
              <div className="text-2xl font-semibold">{top.inv.name}</div>
              <div className="text-sm text-muted-foreground">{top.inv.epithet}</div>
            </div>
          </div>
          <p className="text-sm mt-3">{top.inv.bio}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Secondary matches</div>
            {matches.slice(1).map((m) => (
              <div key={m.inv.slug} className="text-sm py-1">{m.inv.name} <span className="text-xs text-muted-foreground">— {m.inv.primary}</span></div>
            ))}
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Recommended reading</div>
            {books.map((b) => b && <div key={b.slug} className="text-sm py-1">{b.title} <span className="text-xs text-muted-foreground">— {b.author}</span></div>)}
          </div>
        </div>
        <button onClick={restart} className="text-sm text-primary hover:underline">Retake quiz</button>
      </div>
    );
  }

  const q = QUIZ[step];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-xs font-mono text-muted-foreground">Question {step + 1} of {QUIZ.length}</div>
      <h3 className="text-xl font-semibold">{q.q}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.opts.map((opt, i) => (
          <button key={i} onClick={() => { const next = [...answers, i]; setAnswers(next); if (next.length < QUIZ.length) setStep(step + 1); }}
            className="rounded-lg border border-border/60 bg-card/40 p-4 text-left hover:border-primary/60 hover:bg-card/60">
            {opt.t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============ COMPARE ============ */
function CompareTab() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (slug: string) => {
    setPicked((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : prev.length >= 3 ? prev : [...prev, slug]);
  };
  const invs = picked.map((s) => INVESTORS_BY_SLUG[s]).filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Pick up to 3 legends to compare.</div>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
        {INVESTORS.map((i) => (
          <button key={i.slug} onClick={() => toggle(i.slug)}
            className={`px-2 py-1 rounded-full text-xs border ${picked.includes(i.slug) ? "bg-primary/20 border-primary text-primary" : "border-border/60 text-muted-foreground"}`}>
            {i.name}
          </button>
        ))}
      </div>
      {invs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ["Style", (i: Investor) => i.primary],
                ["Time horizon", (i: Investor) => i.holdingPeriod],
                ["Concentration", (i: Investor) => i.concentration],
                ["CAGR (approx.)", (i: Investor) => i.cagr],
                ["Framework", (i: Investor) => i.framework.name],
                ["Strength", (i: Investor) => i.strength],
                ["Blind spot", (i: Investor) => i.blindspot],
              ].map(([label, fn]) => (
                <tr key={label as string} className="border-b border-border/40">
                  <td className="py-2 pr-4 text-xs font-mono uppercase text-muted-foreground align-top w-40">{label as string}</td>
                  {invs.map((i) => (<td key={i.slug} className="py-2 pr-4 align-top">{(fn as (i: Investor) => string)(i)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

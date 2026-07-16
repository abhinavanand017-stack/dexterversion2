import type { Playbook } from "./types";

export const PLAYBOOKS: Playbook[] = [
  {
    slug: "moat-checklist",
    title: "The Moat Checklist",
    sourceInvestors: ["buffett","munger","fisher"],
    description: "Score a business on the five classical sources of durable competitive advantage.",
    kind: "moatChecklist",
    linkTool: { label: "Try on live NSE data", href: "/screener" },
  },
  {
    slug: "margin-of-safety",
    title: "Margin of Safety Calculator",
    sourceInvestors: ["graham","klarman"],
    description: "Estimate intrinsic value, compare to price, and identify the discount that would let you sleep at night.",
    kind: "marginOfSafety",
    linkTool: { label: "Screen for cheap stocks", href: "/screener" },
  },
  {
    slug: "qglp",
    title: "QGLP · Buy Right, Sit Tight",
    sourceInvestors: ["agrawal","mukherjea"],
    description: "Quality, Growth, Longevity, Price — a four-axis scorecard for long-term Indian compounders.",
    kind: "qglp",
  },
  {
    slug: "smile",
    title: "The SMILE Framework",
    sourceInvestors: ["kedia"],
    description: "Small in size, Medium in experience, Large in aspiration, Extra-large in market potential — Kedia's small-cap discovery lens.",
    kind: "smile",
  },
  {
    slug: "position-sizing",
    title: "Position Sizing & Risk of Ruin",
    sourceInvestors: ["druckenmiller","tudor-jones","thorp"],
    description: "A Kelly-inspired sizing calculator with a plain-English guardrail against betting the farm.",
    kind: "positionSizing",
    linkTool: { label: "Open Portfolio", href: "/portfolio" },
  },
  {
    slug: "cycle-gauge",
    title: "Cycle Awareness Gauge",
    sourceInvestors: ["marks","naren"],
    description: "Self-assess valuation, sentiment, credit, and IPO froth to place today on a 1–10 cycle thermometer.",
    kind: "cycleGauge",
  },
  {
    slug: "consistent-compounder",
    title: "The Consistent Compounder Score",
    sourceInvestors: ["mukherjea","agrawal"],
    description: "ROCE, revenue-growth consistency, and promoter integrity → a composite compounder score.",
    kind: "compounderScore",
    linkTool: { label: "Open Screener", href: "/screener" },
  },
  {
    slug: "behavioral-guardrail",
    title: "Behavioural Guardrail Checklist",
    sourceInvestors: ["bakshi","parikh"],
    description: "A pre-trade checklist that fights recency bias, loss aversion, herding, and overconfidence.",
    kind: "behavioralGuardrail",
  },
];

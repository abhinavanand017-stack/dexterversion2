export type Category =
  | "Value" | "Growth" | "Macro" | "Quant" | "Activist"
  | "Contrarian" | "Trend" | "India" | "Passive" | "Behavioral";

export interface Investor {
  slug: string;
  name: string;
  epithet: string;
  country: string;   // ISO-ish label
  flag: string;      // emoji
  era: string;       // "1965–present"
  eraStart: number;  // decade start, e.g. 1960
  categories: Category[];
  primary: Category;
  cagr: string;      // "~20% CAGR (approx., historical, educational only)"
  cagrNum: number;   // best-effort numeric for compounding sandbox default
  principles: string[];   // 5
  avoids: string[];       // 3
  allocation: Array<{ name: string; value: number }>; // approx blueprint
  holdingPeriod: string;
  concentration: string;
  framework: { name: string; detail: string; items?: string[] };
  caseStudy: string;     // 3-4 sentences
  quote: string;         // <15 words
  quoteVerified: boolean;
  strength: string;
  blindspot: string;
  bookSlugs: string[];   // recommended books
  bio: string;           // 1-2 sentences
}

export interface Book {
  slug: string;
  title: string;
  author: string;
  tags: string[];
  takeaway: string;
  investors: string[]; // investor slugs
  shelf?: "core" | "india";
}

export interface Playbook {
  slug: string;
  title: string;
  sourceInvestors: string[]; // slugs
  description: string;
  kind:
    | "moatChecklist" | "marginOfSafety" | "qglp" | "smile"
    | "positionSizing" | "cycleGauge" | "compounderScore" | "behavioralGuardrail";
  linkTool?: { label: string; href: string };
}

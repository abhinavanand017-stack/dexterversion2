import { createFileRoute } from "@tanstack/react-router";
import { InvestmentMasterclass } from "@/components/InvestmentMasterclass";

export const Route = createFileRoute("/investment-masterclass")({
  head: () => ({
    meta: [
      { title: "Investment Masterclass — DEXTER" },
      { name: "description", content: "Learn how legendary investors — Buffett, Lynch, Graham, Munger, Jhunjhunwala, Dalio — think, allocate, and compound wealth." },
      { property: "og:title", content: "Investment Masterclass — Learn from the Legends" },
      { property: "og:description", content: "Interactive lessons on the world's greatest investors: their philosophy, portfolios, checklists, and compounding math." },
    ],
  }),
  component: MasterclassPage,
});

function MasterclassPage() {
  return <InvestmentMasterclass />;
}

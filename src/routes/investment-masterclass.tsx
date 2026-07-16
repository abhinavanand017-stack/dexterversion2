import { createFileRoute } from "@tanstack/react-router";
import { MasterclassPage } from "@/components/masterclass/MasterclassPage";

export const Route = createFileRoute("/investment-masterclass")({
  head: () => ({
    meta: [
      { title: "Investment Masterclass — DEXTER" },
      { name: "description", content: "50 legendary investors, 30 essential books, 8 interactive playbooks, and a style-matcher quiz. Learn how the greats think, allocate, and compound." },
      { property: "og:title", content: "Investment Masterclass — Learn from the Legends" },
      { property: "og:description", content: "Buffett to Jhunjhunwala, Graham to Simons — interactive lessons, frameworks, and a quiz to find your investing style." },
    ],
  }),
  component: () => <MasterclassPage />,
});

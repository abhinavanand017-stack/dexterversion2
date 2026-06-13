import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dexter — Overview" },
      { name: "description", content: "Live bio-algorithmic trading dashboard with NIFTY, SENSEX, and India VIX." },
    ],
  }),
  component: DashboardView,
});

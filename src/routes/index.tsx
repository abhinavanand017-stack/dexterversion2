import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dexter — Bio-Algorithmic Trading Engine" },
      {
        name: "description",
        content:
          "A cognitive firewall between human impulse and capital markets. Real-time biometric risk control for NSE/BSE traders.",
      },
      { property: "og:title", content: "Dexter — The Cognitive Firewall for Indian Markets" },
      {
        property: "og:description",
        content:
          "Bio-algorithmic trading that reads your biometrics and protects your portfolio from your own impulses.",
      },
      { name: "theme-color", content: "#0a0a1a" },
    ],
  }),
  component: DashboardView,
});

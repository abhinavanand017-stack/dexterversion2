import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "./dashboard";

// Mount the dashboard at "/" so the root URL renders the full app immediately.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dexter — Bio-Algorithmic Trading Engine" },
      {
        name: "description",
        content:
          "A cognitive firewall between human impulse and capital markets. Real-time biometric risk control for NSE/BSE traders.",
      },
    ],
  }),
  component: Dashboard,
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/backtester")({
  head: () => ({ meta: [{ title: "Backtester — DEXTER" }] }),
  component: () => (
    <div className="dx-glass p-8">
      <h2 className="text-2xl font-display dx-grad-text">Backtester</h2>
      <p className="text-muted-foreground mt-2">Cog-Alpha backtester replaying biometric overlap — coming next.</p>
    </div>
  ),
});

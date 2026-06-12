import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — DEXTER" }] }),
  component: () => (
    <div className="dx-glass p-8">
      <h2 className="text-2xl font-display dx-grad-text">Watchlist</h2>
      <p className="text-muted-foreground mt-2">Personal watchlist with cognitive load tracking — coming next.</p>
    </div>
  ),
});

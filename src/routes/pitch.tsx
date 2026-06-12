import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pitch")({
  head: () => ({ meta: [{ title: "Pitch Deck — DEXTER" }] }),
  component: () => (
    <div className="dx-glass p-8">
      <h2 className="text-2xl font-display dx-grad-text">Pitch Deck</h2>
      <p className="text-muted-foreground mt-2">4-slide investor narrative — coming next.</p>
    </div>
  ),
});

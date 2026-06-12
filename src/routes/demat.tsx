import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/demat")({
  head: () => ({ meta: [{ title: "Demat Gateway — DEXTER" }] }),
  component: () => (
    <div className="dx-glass p-8">
      <h2 className="text-2xl font-display dx-grad-text">Demat Gateway</h2>
      <p className="text-muted-foreground mt-2">Zerodha / Angel One broker bridge with BioGuard — coming next.</p>
    </div>
  ),
});

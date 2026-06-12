import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scanner")({
  head: () => ({ meta: [{ title: "Market Scanner — DEXTER" }] }),
  component: () => <Stub title="Market Scanner" desc="NIFTY 500 constituents with bio-aware filters — coming next." />,
});

function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="dx-glass p-8">
      <h2 className="text-2xl font-display dx-grad-text">{title}</h2>
      <p className="text-muted-foreground mt-2">{desc}</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ShadowPortfolio } from "@/components/ShadowPortfolio";

export const Route = createFileRoute("/shadow")({
  head: () => ({ meta: [{ title: "Dexter — Shadow Portfolio" }] }),
  component: Shadow,
});

function Shadow() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <ShadowPortfolio />
    </div>
  );
}

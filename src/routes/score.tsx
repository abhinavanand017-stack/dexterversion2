import { createFileRoute } from "@tanstack/react-router";
import { ScoreHero } from "@/components/ScoreHero";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";

export const Route = createFileRoute("/score")({
  head: () => ({ meta: [{ title: "Dexter — Score" }] }),
  component: ScorePage,
});

function ScorePage() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <ScoreHero />
      <ScoreBreakdown />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { BiometricSource } from "@/components/BiometricSource";
import { TradingPsychSuite, BiometricMoodRing } from "@/components/TradingPsychSuite";

export const Route = createFileRoute("/biometrics")({
  head: () => ({
    meta: [
      { title: "Biometrics Lab — DEXTER" },
      { name: "description", content: "Turn your heart rate, HRV, sleep and stress into trading guardrails. Includes bias detection, dynamic position sizing, circuit breakers, and risk-tolerance quiz." },
    ],
  }),
  component: Biometrics,
});

function Biometrics() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <BiometricMoodRing />

      <div className="dx-glass p-6">
        <h2 className="font-display text-xl mb-3">Biometric Source</h2>
        <BiometricSource />
      </div>

      <TradingPsychSuite />
    </div>
  );
}

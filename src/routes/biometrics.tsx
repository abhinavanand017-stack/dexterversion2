import { createFileRoute } from "@tanstack/react-router";
import { BiometricSource } from "@/components/BiometricSource";

export const Route = createFileRoute("/biometrics")({
  head: () => ({ meta: [{ title: "Dexter — Biometrics Lab" }] }),
  component: Biometrics,
});

function Biometrics() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <div className="dx-glass p-6">
        <h2 className="font-display text-xl mb-3">Biometrics Lab</h2>
        <BiometricSource />
      </div>
    </div>
  );
}

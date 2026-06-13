import { useDexterState } from "@/hooks/useDexterState";

export function DemoPill() {
  const demoMode = useDexterState((s) => s.demoMode);
  if (!demoMode) return null;
  return (
    <span
      className="ml-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
      style={{ background: "#451a03", color: "#f59e0b" }}
    >
      Demo
    </span>
  );
}

import { useEffect } from "react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useDexterState, type BiometricSource as BS } from "@/hooks/useDexterState";

const OPTIONS: Array<{ value: BS; label: string; badge?: string }> = [
  { value: "demo",   label: "Demo Mode (Synthetic)", badge: "default" },
  { value: "manual", label: "Manual Input (Sliders)" },
  { value: "apple",  label: "Apple Health (coming soon)" },
  { value: "garmin", label: "Garmin Connect (coming soon)" },
  { value: "whoop",  label: "Whoop (coming soon)" },
];

export function BiometricSource() {
  const source = useDexterState((s) => s.bioSource);
  const setSource = useDexterState((s) => s.setBioSource);
  const manual = useDexterState((s) => s.manualBio);
  const setManual = useDexterState((s) => s.setManualBio);
  const setArousal = useDexterState((s) => s.setArousal);
  const setLambda = useDexterState((s) => s.setLambda);

  // When manual source is active, derive arousal + lambda from sliders.
  useEffect(() => {
    if (source !== "manual") return;
    // Simple model: arousal rises with stress + low HRV + low sleep
    const arousal = Math.min(1, Math.max(0,
      0.4 * manual.stress + 0.3 * (1 - manual.hrv / 120) + 0.3 * (1 - manual.sleep / 100),
    ));
    setArousal(arousal);
    setLambda(2 + arousal * 7); // 2 → 9
  }, [source, manual, setArousal, setLambda]);

  const handleChange = (v: BS) => {
    if (v === "apple" || v === "garmin" || v === "whoop") {
      toast.info(`${v.charAt(0).toUpperCase() + v.slice(1)} integration coming soon`, {
        description: "Production builds will sync directly via OAuth.",
      });
      return;
    }
    setSource(v);
  };

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Source</label>
        <Select value={source} onValueChange={(v) => handleChange(v as BS)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.value === "demo" && "🟡 "}
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="dx-pill" style={{ background: "#451a03", color: "#f59e0b" }}>
          {source === "demo" ? "Synthetic" : source === "manual" ? "Manual" : "Wearable"}
        </span>
      </div>

      {source === "manual" && (
        <div className="mt-6 grid sm:grid-cols-2 gap-5">
          <SliderRow label="HRV (ms)"     value={manual.hrv}    min={20} max={120} step={1}
            onChange={(v) => setManual({ hrv: v })} suffix="ms" />
          <SliderRow label="Heart Rate"   value={manual.hr}     min={40} max={140} step={1}
            onChange={(v) => setManual({ hr: v })} suffix=" BPM" />
          <SliderRow label="Sleep Score"  value={manual.sleep}  min={0}  max={100} step={1}
            onChange={(v) => setManual({ sleep: v })} suffix="/100" />
          <SliderRow label="Stress Level" value={manual.stress} min={0}  max={1}   step={0.01}
            onChange={(v) => setManual({ stress: v })} suffix=""
            display={(v) => v < 0.33 ? "Low" : v < 0.66 ? "Medium" : "High"} />
        </div>
      )}

      <div className="mt-4 text-[11px] text-muted-foreground font-mono">
        HRV: {manual.hrv}ms · Source: {source === "demo" ? "Demo simulation" : source === "manual" ? "Manual input" : "Wearable"} · Updated just now
      </div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, suffix, display,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix: string; display?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-2">
        <span>{label}</span>
        <span className="text-amber-400">{display ? display(value) : `${value}${suffix}`}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

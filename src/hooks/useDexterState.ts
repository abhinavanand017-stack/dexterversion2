import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ArousalLevel = "low" | "nominal" | "elevated" | "critical";
export type UIMode = "full" | "minimal";
export type BiometricSource = "demo" | "manual" | "apple" | "garmin" | "whoop";
export type DataHealth = "live" | "degraded" | "offline";

export interface BiometricReading {
  hrv: number;        // ms
  hr: number;         // bpm
  sleep: number;      // 0..100
  stress: number;     // 0..1
}

interface DexterState {
  arousal: number;
  arousalLevel: ArousalLevel;
  hrv: number;
  sleepQuality: number;
  lambda: number;            // 1..10
  dexterScore: number;       // 0..100
  scoreTrend: number;        // weekly delta
  uiMode: UIMode;
  circuitBreakerActive: boolean;
  demoMode: boolean;
  bioSource: BiometricSource;
  manualBio: BiometricReading;
  dataHealth: DataHealth;
  tourActive: boolean;
  setArousal: (v: number) => void;
  setLambda: (v: number) => void;
  setMode: (m: UIMode) => void;
  setDexterScore: (n: number) => void;
  setDemoMode: (b: boolean) => void;
  setBioSource: (s: BiometricSource) => void;
  setManualBio: (b: Partial<BiometricReading>) => void;
  setCircuitBreaker: (b: boolean) => void;
  setDataHealth: (h: DataHealth) => void;
  setTour: (b: boolean) => void;
}

function level(a: number): ArousalLevel {
  if (a >= 0.75) return "critical";
  if (a >= 0.5) return "elevated";
  if (a >= 0.25) return "nominal";
  return "low";
}

export const useDexterState = create<DexterState>()(
  persist(
    (set) => ({
      arousal: 0.28,
      arousalLevel: "nominal",
      hrv: 72,
      sleepQuality: 0.82,
      lambda: 3.2,
      dexterScore: 74,
      scoreTrend: 3,
      uiMode: "full",
      circuitBreakerActive: false,
      demoMode: false,
      bioSource: "demo",
      manualBio: { hrv: 58, hr: 72, sleep: 78, stress: 0.2 },
      dataHealth: "live",
      tourActive: false,
      setArousal: (v) => set({ arousal: v, arousalLevel: level(v) }),
      setLambda: (lambda) => set({ lambda }),
      setMode: (uiMode) => set({ uiMode }),
      setDexterScore: (dexterScore) => set({ dexterScore }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setBioSource: (bioSource) => set({ bioSource }),
      setManualBio: (b) => set((s) => ({ manualBio: { ...s.manualBio, ...b } })),
      setCircuitBreaker: (circuitBreakerActive) => set({ circuitBreakerActive }),
      setDataHealth: (dataHealth) => set({ dataHealth }),
      setTour: (tourActive) => set({ tourActive }),
    }),
    {
      name: "dexter-state",
      version: 2,
      migrate: (persisted: any, version) => {
        if (version < 2 && persisted) persisted.demoMode = false;
        return persisted;
      },
      partialize: (s) => ({ demoMode: s.demoMode, uiMode: s.uiMode, bioSource: s.bioSource }),
    },
  ),
);

export function lambdaLabel(l: number): string {
  if (l < 2.5) return "Aggressive Growth";
  if (l < 4.5) return "Balanced";
  if (l < 7) return "Capital Preservation";
  return "Panic Mode — Maximum Safety";
}

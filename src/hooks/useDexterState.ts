import { create } from "zustand";

export type ArousalLevel = "low" | "nominal" | "elevated" | "critical";
export type UIMode = "full" | "minimal";

interface DexterState {
  arousal: number;          // 0..1
  arousalLevel: ArousalLevel;
  hrv: number;
  sleepQuality: number;
  lambda: number;           // 0..1 — bio-fitness
  dexterScore: number;      // 0..100
  uiMode: UIMode;
  circuitBreakerActive: boolean;
  setArousal: (v: number) => void;
  setMode: (m: UIMode) => void;
  setDexterScore: (n: number) => void;
}

function level(a: number): ArousalLevel {
  if (a >= 0.75) return "critical";
  if (a >= 0.5) return "elevated";
  if (a >= 0.25) return "nominal";
  return "low";
}

export const useDexterState = create<DexterState>((set) => ({
  arousal: 0.23,
  arousalLevel: "low",
  hrv: 72,
  sleepQuality: 0.82,
  lambda: 0.63,
  dexterScore: 87,
  uiMode: "full",
  circuitBreakerActive: false,
  setArousal: (v) => set({ arousal: v, arousalLevel: level(v) }),
  setMode: (uiMode) => set({ uiMode }),
  setDexterScore: (dexterScore) => set({ dexterScore }),
}));

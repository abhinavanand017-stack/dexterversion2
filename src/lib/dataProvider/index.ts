// Single entry point + mode switch. Flip DATA_MODE in one place.
import type { DataProvider } from "./types";
import { StaticProvider } from "./staticProvider";
import { LiveProvider } from "./liveProvider";

export type DataMode = "static" | "live";
const LS_MODE = "dx_data_mode";

export function getDataMode(): DataMode {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(LS_MODE);
    if (v === "live" || v === "static") return v;
  }
  return "static";
}
export function setDataMode(mode: DataMode) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LS_MODE, mode);
  _instance = null;
}

let _instance: DataProvider | null = null;
export function getDataProvider(): DataProvider {
  if (_instance) return _instance;
  _instance = getDataMode() === "live" ? new LiveProvider() : new StaticProvider();
  return _instance;
}

export * from "./types";
export { getStore, setOverride, resetOverride, parseCsv } from "./store";

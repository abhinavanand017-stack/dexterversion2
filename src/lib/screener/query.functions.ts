import { createServerFn } from "@tanstack/react-start";
import type { ScreenerFilters, SortKey } from "./query.server";

export const screenerQuery = createServerFn({ method: "POST" })
  .inputValidator((input: {
    filters: ScreenerFilters;
    sortKey: SortKey;
    sortDir: "asc" | "desc";
    page: number;
    pageSize: number;
  }) => input)
  .handler(async ({ data }) => {
    const { runScreenerQuery } = await import("./query.server");
    return runScreenerQuery(data);
  });

export const screenerCoverage = createServerFn({ method: "GET" }).handler(async () => {
  const { runCoverage } = await import("./query.server");
  return runCoverage();
});

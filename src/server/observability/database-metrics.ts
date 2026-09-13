import { AsyncLocalStorage } from "node:async_hooks";
export interface DatabaseMeasurement { queryCount: number; queryDurationMs: number }
const storage = new AsyncLocalStorage<DatabaseMeasurement>();
export function recordQuery(duration: number) { const metric=storage.getStore(); if(metric){metric.queryCount++;metric.queryDurationMs+=duration;} }
export async function measureDatabase<T>(operation:()=>Promise<T>) {
  const metrics: DatabaseMeasurement={queryCount:0,queryDurationMs:0};
  const started=performance.now();
  const value=await storage.run(metrics,operation);
  return {value,metrics:{...metrics,latencyMs:performance.now()-started}};
}

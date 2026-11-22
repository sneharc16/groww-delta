import { createHash } from "node:crypto";
/** Canonical JSON: sorted object keys, preserved array order, explicit BigInt decimal. */
export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return "[" + value.map(item => canonicalJson(item ?? null)).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite numbers cannot enter reproducible records.");
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("Unsupported canonical value.");
  return result;
}
export const contentHash = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores(["fin-baddie/**", "research/exports/**", "research/benchmarks/results/**", ".next/**", "coverage/**", "playwright-report/**", "test-results/**", "src/generated/**"]),
]);

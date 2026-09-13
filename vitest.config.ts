import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": `${import.meta.dirname}/src` } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});

import { mkdir,writeFile } from "node:fs/promises";
import { cpus,platform,arch,totalmem } from "node:os";
import { executionIdentity } from "../execution";
import { benchmark } from "../benchmarks/runner";
import { BUILD_INFO } from "../../src/lib/build-info";
import { contentHash } from "../../src/domain/policy/hash";
import { REFERENCE_POLICY } from "../../src/domain/policy/reference";
const results=[];
for(const count of [5,50,500,5000]) { const result=benchmark(count); results.push(result); console.log(JSON.stringify(result)); }
const report={...BUILD_INFO,...executionIdentity(),policyHash:contentHash(REFERENCE_POLICY),seed:0,executionTimestamp:new Date().toISOString(),
  environment:{node:process.version,platform:platform(),architecture:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem()},
  measurement:"Offline full domain analysis including trace generation; excludes database/network/UI. Memory is observed process memory, not isolated peak allocation. p99 omitted for 20 samples.",results};
await mkdir("research/benchmarks/results",{recursive:true});
await writeFile("research/benchmarks/results/latest.json",JSON.stringify(report,null,2)+"\n");

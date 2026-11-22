import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { contentHash } from "../src/domain/policy/hash";
export function executionIdentity() {
  const paths=execFileSync("git",["ls-files","-co","--exclude-standard","--","src","data","research","prisma","scripts","package.json","pnpm-lock.yaml"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  const unique=[...new Set(paths)].sort();
  const files=unique.map(path=>({path,hash:contentHash(readFileSync(path,"utf8"))}));
  return {codeCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),sourceTreeHash:contentHash(files),
    dirtySource:execFileSync("git",["status","--porcelain","--","src","data","research","prisma","scripts","package.json","pnpm-lock.yaml"],{encoding:"utf8"}).trim().length>0};
}

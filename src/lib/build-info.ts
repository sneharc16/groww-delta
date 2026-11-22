import { REFERENCE_POLICY } from "@/domain/policy/reference";
export const BUILD_INFO = {
  applicationVersion: "5.0.0",
  schemaVersion: "20260909020000_build5_replay_pin",
  policyVersion: REFERENCE_POLICY.version,
  codeCommit: process.env.BUILD_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unrecorded-development",
} as const;

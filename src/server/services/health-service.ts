import { databaseSchemaCompatible } from "@/server/repositories/health-repository";
import { BUILD_INFO } from "@/lib/build-info";
import { contentHash } from "@/domain/policy/hash";
import { REFERENCE_POLICY } from "@/domain/policy/reference";
export async function healthStatus() {
  try {
    const compatible=await databaseSchemaCompatible(BUILD_INFO.schemaVersion);
    return {status:compatible?"OK":"NOT_READY",database:"CONNECTED",schemaCompatible:compatible,provider:{name:"ReplayMarketProvider",status:compatible?"HEALTHY":"UNAVAILABLE"},build:BUILD_INFO,policyConfigHash:contentHash(REFERENCE_POLICY)};
  } catch {
    return {status:"UNAVAILABLE",database:"UNAVAILABLE",schemaCompatible:false,provider:{name:"ReplayMarketProvider",status:"UNAVAILABLE"},build:BUILD_INFO};
  }
}

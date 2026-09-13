import { z } from "zod";
const environmentSchema=z.object({
  DATABASE_URL:z.string().url().refine(value=>URL.canParse(value) && ["postgres:","postgresql:"].includes(new URL(value).protocol)),
  DEMO_MODE:z.enum(["true","false"]).default("true"),
  DATABASE_POOL_SIZE:z.coerce.number().int().min(1).max(100).default(5),
});
export function validateEnvironment(source:Record<string,string|undefined>) {
  const result=environmentSchema.safeParse(source);
  if(!result.success)throw new Error("Invalid server configuration: "+result.error.issues.map(issue=>issue.path.join(".")).join(", "));
  if(result.data.DEMO_MODE!=="true")throw new Error("This reference build supports replay mode only.");
  return result.data;
}

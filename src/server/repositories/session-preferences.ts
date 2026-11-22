import type { Database } from "./database";
import { AppError } from "@/lib/errors/app-error";
export function sessionPreferences(db:Database) {
  return {
    async get(userId:string) {
      const row=await db.anonymousSession.findUnique({where:{userId},select:{showGroupedMoves:true}});
      if(!row)throw new AppError("SESSION_NOT_FOUND","The anonymous session is unavailable.",401);
      return row;
    },
    async set(userId:string,showGroupedMoves:boolean) {
      return db.anonymousSession.update({where:{userId},data:{showGroupedMoves},select:{showGroupedMoves:true}});
    },
  };
}

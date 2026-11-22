import {NextResponse} from "next/server";
import {z} from "zod";
import {withSession} from "@/server/session/request";
import {parseJson} from "@/lib/validation/api";
export async function GET(request:Request) {
  return withSession(request,async({services,userId})=>NextResponse.json(await services.preferences.get(userId)));
}
export async function PATCH(request:Request) {
  return withSession(request,async({services,userId})=>{
    const input=await parseJson(request,z.object({showGroupedMoves:z.boolean()}).strict());
    return NextResponse.json(await services.preferences.set(userId,input.showGroupedMoves));
  });
}

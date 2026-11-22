import { AppError } from "@/lib/errors/app-error";
export const MAX_REQUEST_BYTES = 32_768;
/** Bound bytes before JSON parsing. Never log request bodies. */
export async function boundedBody(request: Request): Promise<string> {
  if(Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new AppError("PAYLOAD_TOO_LARGE","Request body exceeds 32 KiB.",413);
  const reader=request.clone().body?.getReader();
  if(!reader)return "";
  const chunks: Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;
      if(size>MAX_REQUEST_BYTES)throw new AppError("PAYLOAD_TOO_LARGE","Request body exceeds 32 KiB.",413);
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return new TextDecoder().decode(bytes);
  } finally { void reader.cancel().catch(()=>{}); }
}

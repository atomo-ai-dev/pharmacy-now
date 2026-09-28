import { dataMode, getDataSource } from "@/lib/api";
import { handleEmergency } from "@/lib/http/handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleEmergency(new URL(request.url), {
    source: getDataSource(),
    now: new Date(),
    mode: dataMode(),
  });
}

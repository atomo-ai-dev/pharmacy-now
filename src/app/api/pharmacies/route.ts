import { dataMode, getDataSource } from "@/lib/api";
import { handlePharmacies } from "@/lib/http/handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handlePharmacies(new URL(request.url), {
    source: getDataSource(),
    now: new Date(),
    mode: dataMode(),
  });
}

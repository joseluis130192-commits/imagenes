import { key } from "@/lib/kie";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return Response.json({ key: Boolean(key()) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

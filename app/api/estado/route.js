import { key } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ key: Boolean(key()) }, { headers: { "Cache-Control": "no-store" } });
}

import { creditos } from "@/lib/kie";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const r = await creditos();
  if (!r.ok) return Response.json({ saldo: null }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  return Response.json({ saldo: r.saldo }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

import { llamarOpenAI } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const r = await llamarOpenAI("/models");
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado });
  const modelos = (r.datos.data || [])
    .map((m) => m.id)
    .filter((id) => id.includes("image"))
    .sort();
  return Response.json({ modelos }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

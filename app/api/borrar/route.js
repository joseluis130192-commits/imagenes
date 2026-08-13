import { borrarImagen } from "@/lib/openai";

export async function POST(req) {
  const { id } = await req.json();
  const listo = await borrarImagen(id);
  if (!listo) return Response.json({ error: "Esa imagen ya no está en el historial." }, { status: 404 });
  return Response.json({ ok: true });
}

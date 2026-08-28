import { borrarImagen } from "@/lib/almacen";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { id } = await req.json();
  const resultado = await borrarImagen(id);
  if (!resultado.ok) return Response.json({ error: resultado.mensaje, paso: resultado.paso }, { status: 500 });
  return Response.json({ ok: true });
}

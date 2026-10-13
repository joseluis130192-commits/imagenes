import { firmarSubida } from "@/lib/almacen";

export const dynamic = "force-dynamic";

/** Devuelve una URL firmada para que el navegador suba un archivo grande directo al bucket. */
export async function POST(req) {
  const cuerpo = await req.json().catch(() => ({}));
  const ext = String(cuerpo.ext || "").toLowerCase().replace(/^jpeg$/, "jpg");
  try {
    return Response.json(await firmarSubida(ext));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

import { crearTarea } from "@/lib/kie";
import { urlParaKie } from "@/lib/almacen";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

/**
 * Reemplazo de personaje en video. El video llega SIEMPRE como `{ archivo }`: el
 * navegador lo subió directo al bucket (o ya estaba en la galería), porque un clip no
 * entra en el cuerpo de un pedido a Vercel. Acá solo se firma su URL para que Kie la baje.
 * La imagen llega como `{ url }` (subida a Kie) o `{ archivo }` (de la galería).
 */
export async function POST(req) {
  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo) return Response.json({ error: "El pedido no llegó en formato JSON." }, { status: 400 });

  const kie = buscarModeloKie("kie-wan-animate");
  const modo = kie.modos[cuerpo.modo];
  if (!modo) return Response.json({ error: "Elegí Replace o Move." }, { status: 400 });
  const resolucion = modo.resoluciones.includes(cuerpo.resolucion) ? cuerpo.resolucion : modo.resoluciones[0];

  if (!cuerpo.video?.archivo) {
    return Response.json({ error: "El video tiene que subirse al bucket antes de crear la tarea." }, { status: 400 });
  }

  let urlVideo, urlImagen;
  try {
    urlVideo = await urlParaKie({ archivo: cuerpo.video.archivo });
    urlImagen = await urlParaKie(cuerpo.imagen);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (!urlImagen) return Response.json({ error: "Falta la imagen del personaje." }, { status: 400 });

  const r = await crearTarea(modo.model, kie.reemplazar.armarInput({ urlVideo, urlImagen, resolucion }));
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

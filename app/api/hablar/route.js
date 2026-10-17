import { crearTarea } from "@/lib/kie";
import { urlParaKie } from "@/lib/almacen";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

const PROMPT_POR_DEFECTO = "La persona habla a cámara con expresiones naturales y movimientos suaves de cabeza.";

export async function POST(req) {
  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo) return Response.json({ error: "El pedido no llegó en formato JSON." }, { status: 400 });

  const kie = buscarModeloKie(cuerpo.modelo);
  if (!kie?.hablar) return Response.json({ error: "Elegí un modelo de lipsync válido." }, { status: 400 });

  let urlBase, urlAudio;
  try {
    urlBase = await urlParaKie(cuerpo.base);
    urlAudio = await urlParaKie(cuerpo.audio);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (!urlBase) return Response.json({ error: `Elegí ${kie.base === "video" ? "un video" : "una imagen"} base.` }, { status: 400 });
  if (!urlAudio) return Response.json({ error: "Falta el audio." }, { status: 400 });

  const input = kie.hablar.armarInput({
    prompt: (cuerpo.prompt || "").trim() || PROMPT_POR_DEFECTO,
    urlBase,
    urlAudio,
    resolucion: cuerpo.resolucion,
    modo: cuerpo.modo,
  });
  const r = await crearTarea(kie.hablar.model, input);
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

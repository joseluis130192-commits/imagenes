import { crearTarea } from "@/lib/kie";
import { urlParaKie } from "@/lib/almacen";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

const PROMPT_POR_DEFECTO = "Transición suave y continua entre las dos escenas, con movimiento de cámara natural.";

/**
 * Crea la tarea de UN clip de la secuencia (el par imagen N → imagen N+1). El navegador
 * llama esto de a un par por vez y espera a que cada clip termine antes de pedir el
 * siguiente, para no chocar con el límite de pedidos de Kie.
 */
export async function POST(req) {
  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo) return Response.json({ error: "El pedido no llegó en formato JSON." }, { status: 400 });

  const kie = buscarModeloKie("kie-pixverse-transition");

  let primera, ultima;
  try {
    primera = await urlParaKie(cuerpo.primera);
    ultima = await urlParaKie(cuerpo.ultima);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (!primera || !ultima) return Response.json({ error: "Falta una de las dos imágenes del par." }, { status: 400 });

  // La doc pide un prompt de 3 a 5000 caracteres: si no hay uno útil va el de por defecto.
  const prompt = (cuerpo.prompt || "").trim();
  const input = kie.secuencia.armarInput({
    prompt: prompt.length >= 3 ? prompt.slice(0, 5000) : PROMPT_POR_DEFECTO,
    primera,
    ultima,
    calidad: kie.calidadesPermitidas.includes(cuerpo.calidad) ? cuerpo.calidad : "540p",
    duracion: Math.min(15, Math.max(1, Math.round(Number(cuerpo.duracion) || 5))),
    audio: cuerpo.audio === true,
  });

  const r = await crearTarea(kie.secuencia.model, input);
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

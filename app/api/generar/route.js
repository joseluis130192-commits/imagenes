import { crearTarea } from "@/lib/kie";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req) {
  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "El pedido no llegó en formato JSON." }, { status: 400 });
  }

  const prompt = (cuerpo.prompt || "").trim();
  if (!prompt) return Response.json({ error: "Escribí un prompt antes de generar." }, { status: 400 });

  const kie = buscarModeloKie(cuerpo.modelo);
  if (!kie) return Response.json({ error: "Elegí un modelo válido." }, { status: 400 });
  if (!kie.generar) {
    return Response.json({ error: `${kie.nombre} no genera imágenes desde cero: solo edita una que ya tengas.` }, { status: 400 });
  }

  // Kie no devuelve la imagen acá: solo el taskId. El frontend polea /api/tarea/[taskId].
  const input = kie.generar.armarInput(prompt, cuerpo.tamano || "auto", [], cuerpo.formato, cuerpo.calidad);
  const r = await crearTarea(kie.generar.model, input);
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

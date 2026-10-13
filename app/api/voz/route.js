import { crearTarea } from "@/lib/kie";
import { buscarModeloKie } from "@/lib/proveedores";
import { VOCES } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Texto → voz con ElevenLabs. Igual que /api/generar: devuelve el taskId y el frontend polea. */
export async function POST(req) {
  const cuerpo = await req.json().catch(() => ({}));
  const texto = (cuerpo.texto || "").trim();
  if (!texto) return Response.json({ error: "Escribí el texto que tiene que decir la voz." }, { status: 400 });
  if (texto.length > 5000) return Response.json({ error: "El texto no puede pasar de 5000 caracteres." }, { status: 400 });

  const voz = VOCES.some((v) => v.id === cuerpo.voz) ? cuerpo.voz : VOCES[0].id;
  const kie = buscarModeloKie("kie-elevenlabs");
  const r = await crearTarea(kie.voz.model, kie.voz.armarInput({ texto, voz, velocidad: cuerpo.velocidad }));
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

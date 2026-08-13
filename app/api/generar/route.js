import { llamarOpenAI, guardarImagen } from "@/lib/openai";

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

  const pedido = {
    model: cuerpo.modelo || "gpt-image-1-mini",
    prompt,
    n: Math.min(Math.max(Number(cuerpo.cantidad) || 1, 1), 4),
  };
  if (cuerpo.tamano && cuerpo.tamano !== "auto") pedido.size = cuerpo.tamano;
  if (cuerpo.calidad && cuerpo.calidad !== "auto") pedido.quality = cuerpo.calidad;
  if (cuerpo.formato) pedido.output_format = cuerpo.formato;
  if (cuerpo.fondo && cuerpo.fondo !== "auto") pedido.background = cuerpo.fondo;

  const r = await llamarOpenAI("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });

  if (!r.ok) return Response.json({ error: r.mensaje, detalle: r.detalle }, { status: r.estado });

  const candidatas = (r.datos.data || []).filter((i) => i.b64_json);
  const nuevas = await Promise.all(
    candidatas.map((i) =>
      guardarImagen(i.b64_json, cuerpo.formato, {
        prompt,
        modelo: pedido.model,
        calidad: pedido.quality || "auto",
        tamano: pedido.size || "auto",
        origen: "generada",
        promptRevisado: i.revised_prompt || null,
      })
    )
  );

  if (!nuevas.length) {
    return Response.json({ error: "OpenAI respondió sin imágenes. Probá otra vez o cambiá de modelo." }, { status: 502 });
  }

  return Response.json({ imagenes: nuevas, uso: r.datos.usage || null });
}

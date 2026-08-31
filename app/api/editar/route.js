import { crearTarea, subirArchivo } from "@/lib/kie";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Edición con imágenes de referencia. Recibe multipart del navegador, sube cada
 * referencia a Kie (que solo acepta URLs, no binarios) y crea la tarea.
 */
export async function POST(req) {
  let entrada;
  try {
    entrada = await req.formData();
  } catch {
    return Response.json({ error: "No se pudieron leer los archivos enviados." }, { status: 400 });
  }

  const prompt = (entrada.get("prompt") || "").toString().trim();
  if (!prompt) return Response.json({ error: "Escribí qué querés cambiar en la imagen." }, { status: 400 });

  const archivos = entrada.getAll("imagenes").filter((a) => a && typeof a.arrayBuffer === "function");
  if (!archivos.length) return Response.json({ error: "Subí al menos una imagen de referencia." }, { status: 400 });

  const modelo = (entrada.get("modelo") || "").toString();
  const calidad = (entrada.get("calidad") || "medium").toString();
  const tamano = (entrada.get("tamano") || "1024x1024").toString();
  const formato = (entrada.get("formato") || "png").toString();

  const kie = buscarModeloKie(modelo);
  if (!kie) return Response.json({ error: "Elegí un modelo válido." }, { status: 400 });
  if (!kie.editar) {
    return Response.json({ error: `${kie.nombre} no edita imágenes: solo genera desde cero.` }, { status: 400 });
  }

  // Kie pide URLs, no binarios: subimos cada referencia antes de crear la tarea.
  const urls = [];
  for (const archivo of archivos) {
    const subida = await subirArchivo(archivo);
    if (!subida.ok) return Response.json({ error: subida.mensaje }, { status: 502 });
    urls.push(subida.url);
  }

  // Solo se usa cuando kie.tipo === "video"; las entradas de imagen lo ignoran.
  const video = {
    duracion: Number(entrada.get("duracion")) || undefined,
    aspecto: (entrada.get("aspectoVideo") || "").toString() || undefined,
    resolucion: (entrada.get("resolucion") || "").toString() || undefined,
    sonido: entrada.get("sonido") !== "false",
  };

  const input = kie.editar.armarInput(prompt, tamano, urls, formato, calidad, video);
  const r = await crearTarea(kie.editar.model, input);
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
  return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
}

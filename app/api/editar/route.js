import { llamarOpenAI, guardarImagen } from "@/lib/openai";
import { crearTarea, subirArchivo } from "@/lib/kie";
import { buscarModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Edición con imágenes de referencia.
 * Recibe multipart del navegador y arma otro multipart para OpenAI.
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

  const modelo = (entrada.get("modelo") || "gpt-image-1-mini").toString();
  const calidad = (entrada.get("calidad") || "medium").toString();
  const tamano = (entrada.get("tamano") || "1024x1024").toString();
  const formato = (entrada.get("formato") || "png").toString();
  const cantidad = Math.min(Math.max(Number(entrada.get("cantidad")) || 1, 1), 4);

  const kie = buscarModeloKie(modelo);
  if (kie) {
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

    const input = kie.editar.armarInput(prompt, tamano, urls, formato, calidad);
    const r = await crearTarea(kie.editar.model, input);
    if (!r.ok) return Response.json({ error: r.mensaje }, { status: r.estado || 500 });
    return Response.json({ taskId: r.taskId, proveedor: "kie" }, { status: 202 });
  }

  const salida = new FormData();
  salida.append("model", modelo);
  salida.append("prompt", prompt);
  salida.append("n", String(cantidad));
  if (tamano !== "auto") salida.append("size", tamano);
  if (calidad !== "auto") salida.append("quality", calidad);
  for (const archivo of archivos) salida.append("image[]", archivo, archivo.name || "referencia.png");

  const mascara = entrada.get("mascara");
  if (mascara && typeof mascara.arrayBuffer === "function") {
    salida.append("mask", mascara, mascara.name || "mascara.png");
  }

  const r = await llamarOpenAI("/images/edits", { method: "POST", body: salida });
  if (!r.ok) return Response.json({ error: r.mensaje, detalle: r.detalle }, { status: r.estado });

  const candidatas = (r.datos.data || []).filter((i) => i.b64_json);
  let nuevas;
  try {
    nuevas = await Promise.all(
      candidatas.map((i) =>
        guardarImagen(i.b64_json, formato, {
          prompt,
          modelo,
          calidad,
          tamano,
          origen: "editada",
        })
      )
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  if (!nuevas.length) {
    return Response.json({ error: "OpenAI respondió sin imágenes. Probá otra vez." }, { status: 502 });
  }

  return Response.json({ imagenes: nuevas, uso: r.datos.usage || null });
}

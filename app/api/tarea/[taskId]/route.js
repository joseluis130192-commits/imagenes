import { verTarea } from "@/lib/kie";
import { guardarImagenDesdeBuffer } from "@/lib/almacen";
import { tamanoDesdeAspecto, tipoDesdeModeloKie } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Los resultados de video pesan mucho más que una imagen: la descarga desde Kie y la
// resubida a Supabase pueden tardar más que el default de la ruta.
export const maxDuration = 300;

// Campos de `input` que llevan referencias: arrays de URLs (varias imágenes) o un
// string (una sola, como en Recraft/Topaz/el segment-map de Grok, o el first_frame_url
// de Seedance). Sirven para saber si la tarea partió de una imagen ("editada") o no
// ("generada"), y cuántas.
const CAMPOS_IMAGENES_ARRAY = ["input_urls", "image_urls", "image_input"];
const CAMPOS_IMAGENES_STRING = ["image", "image_url", "first_frame_url"];
const EXTENSIONES = ["png", "jpg", "jpeg", "webp", "mp4", "webm"];

/**
 * Se poll ea esta ruta cada 2 segundos con la misma URL (mismo taskId): sin este
 * header, el navegador (o el edge de Vercel) puede quedarse sirviendo la primera
 * respuesta ("waiting") para siempre en vez de volver a consultar Kie.
 */
function json(datos, opciones = {}) {
  return Response.json(datos, {
    ...opciones,
    headers: { "Cache-Control": "no-store, max-age=0", ...(opciones.headers || {}) },
  });
}

function formatoDesdeUrl(url, outputFormat) {
  const limpio = (url || "").split("?")[0];
  const ext = limpio.split(".").pop()?.toLowerCase();
  if (EXTENSIONES.includes(ext)) return ext;
  if (outputFormat) return outputFormat === "jpg" ? "jpg" : outputFormat;
  return "png";
}

/**
 * Kie no devuelve la imagen en la respuesta de creación: hay que pollear esta ruta
 * hasta que la tarea termine. Cuando termina, bajamos la imagen de la URL de resultado
 * y la subimos a Supabase de una — esas URLs de Kie expiran, así que nunca se guardan
 * en la tabla.
 */
export async function GET(_req, { params }) {
  const taskId = params.taskId;
  if (!taskId) return json({ estado: "error", mensaje: "Falta el taskId." }, { status: 400 });

  const r = await verTarea(taskId);
  if (!r.ok) return json({ estado: "error", mensaje: r.mensaje, taskId }, { status: r.estado || 500 });

  if (r.estado === "fail") {
    const codigo = r.failCode ? `[${r.failCode}] ` : "";
    return json({
      estado: "error",
      mensaje: `${codigo}${r.failMsg || "La tarea falló en Kie."}`,
      taskId,
    });
  }

  // Cualquier estado que no sea "success" ni "fail" (incluido uno que Kie sume mañana
  // y todavía no conozcamos) se trata como "sigue en proceso", nunca como error.
  if (r.estado !== "success") {
    return json({ estado: "procesando", ultimoEstado: r.estado || "desconocido", taskId });
  }

  if (r.errorParseo) {
    return json({
      estado: "error",
      mensaje: `Kie marcó la tarea como lista pero el resultado no se pudo leer: ${r.errorParseo}`,
      taskId,
    });
  }

  const urlResultado = r.resultUrls?.[0];
  if (!urlResultado) {
    return json(
      { estado: "error", mensaje: "Kie marcó la tarea como lista pero no devolvió ninguna imagen.", taskId }
    );
  }

  let buffer;
  try {
    const descarga = await fetch(urlResultado);
    if (!descarga.ok) throw new Error(`la descarga respondió ${descarga.status}`);
    buffer = Buffer.from(await descarga.arrayBuffer());
  } catch (err) {
    return json(
      { estado: "error", mensaje: `No se pudo descargar el resultado de Kie: ${err.message}`, taskId },
      { status: 502 }
    );
  }

  const input = r.param?.input || {};
  const campoArray = CAMPOS_IMAGENES_ARRAY.find((c) => Array.isArray(input[c]) && input[c].length);
  const campoString = !campoArray && CAMPOS_IMAGENES_STRING.find((c) => typeof input[c] === "string" && input[c]);
  const tieneReferencias = Boolean(campoArray || campoString);
  const formato = formatoDesdeUrl(urlResultado, input.output_format);

  let ficha;
  try {
    ficha = await guardarImagenDesdeBuffer(buffer, formato, {
      prompt: input.prompt || "",
      modelo: r.modelo || "kie",
      calidad: input.resolution || "kie",
      tamano: tamanoDesdeAspecto(input.aspect_ratio),
      origen: tieneReferencias ? "editada" : "generada",
      referencias: campoArray ? input[campoArray].length : campoString ? 1 : null,
      tipo: tipoDesdeModeloKie(r.modelo),
    });
  } catch (err) {
    return json({ estado: "error", mensaje: err.message, taskId }, { status: 500 });
  }

  // El costo real de Kie, no una estimación: se guarda en la ficha para que el medidor
  // sume lo que realmente se gastó.
  ficha.creditosConsumidos = r.creditosConsumidos;

  return json({ estado: "listo", imagen: ficha, taskId });
}

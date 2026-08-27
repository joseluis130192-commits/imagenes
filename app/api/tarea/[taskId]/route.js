import { verTarea } from "@/lib/kie";
import { guardarImagenDesdeBuffer } from "@/lib/openai";
import { tamanoDesdeAspecto } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS_IMAGENES = ["input_urls", "image_urls", "image_input"];
const EXTENSIONES = ["png", "jpg", "jpeg", "webp"];

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
  const campoImagenes = CAMPOS_IMAGENES.find((c) => Array.isArray(input[c]) && input[c].length);
  const formato = formatoDesdeUrl(urlResultado, input.output_format);

  let ficha;
  try {
    ficha = await guardarImagenDesdeBuffer(buffer, formato, {
      prompt: input.prompt || "",
      modelo: r.modelo || "kie",
      calidad: input.resolution || "kie",
      tamano: tamanoDesdeAspecto(input.aspect_ratio),
      origen: campoImagenes ? "editada" : "generada",
      referencias: campoImagenes ? input[campoImagenes].length : null,
    });
  } catch (err) {
    return json({ estado: "error", mensaje: err.message, taskId }, { status: 500 });
  }

  // El costo real de Kie, no una estimación: se guarda en la ficha para que el medidor
  // sume lo que realmente se gastó.
  ficha.creditosConsumidos = r.creditosConsumidos;

  return json({ estado: "listo", imagen: ficha, taskId });
}

import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const BUCKET = "imagenes";

const TIPOS = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/**
 * Arma un mensaje con la causa real de un fallo de red. `fetch` en el runtime de
 * Node (undici) guarda el motivo verdadero en `err.cause` (ENOTFOUND, ECONNREFUSED,
 * ERR_TLS_CERT_ALTNAME_INVALID, UND_ERR_CONNECT_TIMEOUT, etc.), pero el mensaje de
 * más arriba suele ser solo "fetch failed", que no dice nada.
 */
function detalleError(err) {
  const partes = [err?.message || String(err)];
  const causa = err?.cause;
  if (causa?.code) partes.push(`code=${causa.code}`);
  if (causa?.errno !== undefined) partes.push(`errno=${causa.errno}`);
  if (causa?.message && causa.message !== err?.message) partes.push(`causa=${causa.message}`);
  return partes.join(" · ");
}

/**
 * Limpia un nombre para usarlo como clave de objeto en Storage. Una clave vacía o que
 * empieza con "/" es lo que produce el "Invalid path specified in request URL" de
 * Supabase, así que acá cortamos cualquier ruta previa y validamos el resultado.
 */
export function claveObjeto(nombre) {
  const clave = (nombre || "").split("/").pop().trim();
  if (!clave) throw new Error(`Clave de objeto inválida (recibí: "${nombre}")`);
  return clave;
}

export async function leerHistorial() {
  let data, error;
  try {
    ({ data, error } = await supabase
      .from("imagenes")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(800));
  } catch (err) {
    console.error(`No se pudo leer el historial: ${detalleError(err)}`);
    return [];
  }

  if (error) {
    console.error(`No se pudo leer el historial: ${detalleError(error)}`);
    return [];
  }

  return data.map((fila) => ({
    id: fila.id,
    archivo: fila.archivo,
    url: "/api/imagen/" + fila.archivo,
    fecha: fila.fecha,
    prompt: fila.prompt,
    modelo: fila.modelo,
    calidad: fila.calidad,
    tamano: fila.tamano,
    origen: fila.origen,
    tipo: fila.tipo || "imagen",
    promptRevisado: fila.prompt_revisado,
  }));
}

/**
 * Sube un buffer ya armado al bucket e inserta su fila en la tabla. Es el paso común
 * entre `guardarImagen` (llega en base64) y `guardarImagenDesdeBuffer` (llega como un
 * binario ya descargado de la URL de resultado de la tarea de Kie).
 */
async function subirYRegistrar(buffer, ext, ficha) {
  const id = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const archivo = `${id}.${ext}`;
  const clave = claveObjeto(archivo);

  try {
    const { error: subidaError } = await supabase.storage
      .from(BUCKET)
      .upload(clave, buffer, { contentType: TIPOS[ext] || "image/png" });
    if (subidaError) throw subidaError;
  } catch (err) {
    throw new Error(`No se pudo subir la imagen: ${detalleError(err)}`);
  }

  // Columnas exactas de la tabla: nada de spread de la ficha, que trae `url` y
  // `promptRevisado` (camelCase) que PostgREST no reconoce y rechazan la fila entera.
  const fila = {
    id,
    archivo,
    prompt: ficha.prompt,
    modelo: ficha.modelo,
    calidad: ficha.calidad,
    tamano: ficha.tamano,
    origen: ficha.origen,
    tipo: ficha.tipo || "imagen",
    prompt_revisado: ficha.promptRevisado || null,
    referencias: ficha.referencias ?? null,
  };

  const { data: filaGuardada, error: insertError } = await supabase.from("imagenes").insert(fila).select().single();
  if (insertError) {
    // El objeto ya está en Storage: si la fila no se puede crear, no lo dejamos huérfano.
    await supabase.storage.from(BUCKET).remove([clave]).catch(() => {});
    throw new Error(
      `No se pudo registrar la imagen: ${insertError.message} (code ${insertError.code}, details ${insertError.details})`
    );
  }

  return {
    id: filaGuardada.id,
    archivo: filaGuardada.archivo,
    url: `/api/imagen/${filaGuardada.archivo}`,
    fecha: filaGuardada.fecha,
    prompt: filaGuardada.prompt,
    modelo: filaGuardada.modelo,
    calidad: filaGuardada.calidad,
    tamano: filaGuardada.tamano,
    origen: filaGuardada.origen,
    tipo: filaGuardada.tipo || "imagen",
    promptRevisado: filaGuardada.prompt_revisado,
  };
}

/** Guarda una imagen en base64 y devuelve su ficha para el historial. */
export async function guardarImagen(b64, formato, ficha) {
  const ext = formato === "jpeg" ? "jpg" : formato || "png";
  return subirYRegistrar(Buffer.from(b64, "base64"), ext, ficha);
}

/** Guarda una imagen o video ya descargado como Buffer (Kie) y devuelve su ficha para el historial. */
export async function guardarImagenDesdeBuffer(buffer, formato, ficha) {
  const ext = formato === "jpeg" ? "jpg" : formato || "png";
  return subirYRegistrar(buffer, ext, ficha);
}

/**
 * URL temporal de lectura para un objeto que ya está en el bucket (una imagen o un
 * video de la galería, un audio de voz generado o una entrada subida directo). Kie la
 * baja apenas arranca la tarea, así que alcanza con una hora.
 */
export async function firmarLectura(archivo, segundos = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(claveObjeto(archivo), segundos);
  if (error || !data?.signedUrl) throw new Error(`No se pudo firmar ${archivo}: ${error?.message || "sin URL"}`);
  return data.signedUrl;
}

/**
 * URL firmada para que el navegador suba un archivo directo al bucket, sin pasar por
 * nuestra API (en Vercel el cuerpo de un pedido no puede pasar de ~4.5MB, y un video
 * base puede pesar cientos). Se guarda con el prefijo "entrada-" y sin fila en la
 * tabla: no aparece en la galería, y limpiar-bucket.mjs la borra junto con los huérfanos.
 */
export async function firmarSubida(ext) {
  if (!TIPOS[ext]) throw new Error(`Formato no permitido: ${ext}`);
  const archivo = `entrada-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(archivo);
  if (error || !data?.signedUrl) throw new Error(`No se pudo preparar la subida: ${error?.message || "sin URL"}`);
  return { archivo, signedUrl: data.signedUrl, tipo: TIPOS[ext] };
}

export async function borrarImagen(id) {
  console.log("borrar:", "buscar", id);
  const { data: fila, error: buscarError } = await supabase
    .from("imagenes")
    .select("archivo")
    .eq("id", id)
    .maybeSingle();

  if (buscarError) return { ok: false, paso: "buscar", mensaje: buscarError.message };
  if (!fila) return { ok: false, paso: "buscar", mensaje: "No existe la fila con id " + id };

  const archivo = fila.archivo;

  console.log("borrar:", "storage", id, archivo);
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([claveObjeto(archivo)]);
  if (storageError) return { ok: false, paso: "storage", mensaje: storageError.message };

  console.log("borrar:", "tabla", id, archivo);
  const { error: tablaError } = await supabase.from("imagenes").delete().eq("id", id);
  if (tablaError) return { ok: false, paso: "tabla", mensaje: tablaError.message };

  return { ok: true };
}

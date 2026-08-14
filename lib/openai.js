import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const BUCKET = "imagenes";
const API_BASE = "https://api.openai.com/v1";

export function key() {
  return process.env.OPENAI_API_KEY || "";
}

const TIPOS = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
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
    promptRevisado: fila.prompt_revisado,
  }));
}

/** Guarda una imagen en base64 y devuelve su ficha para el historial. */
export async function guardarImagen(b64, formato, ficha) {
  const ext = formato === "jpeg" ? "jpg" : formato || "png";
  const id = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const archivo = `${id}.${ext}`;
  const buffer = Buffer.from(b64, "base64");

  try {
    const { error: subidaError } = await supabase.storage
      .from(BUCKET)
      .upload(archivo, buffer, { contentType: TIPOS[ext] || "image/png" });
    if (subidaError) throw subidaError;
  } catch (err) {
    throw new Error(`No se pudo subir la imagen: ${detalleError(err)}`);
  }

  const fecha = new Date().toISOString();
  const fila = {
    id,
    archivo,
    fecha,
    prompt: ficha.prompt,
    modelo: ficha.modelo,
    calidad: ficha.calidad,
    tamano: ficha.tamano,
    origen: ficha.origen,
    prompt_revisado: ficha.promptRevisado || null,
  };

  try {
    const { error: insertError } = await supabase.from("imagenes").insert(fila);
    if (insertError) throw insertError;
  } catch (err) {
    throw new Error(`No se pudo guardar el registro: ${detalleError(err)}`);
  }

  return {
    id,
    archivo,
    url: `/api/imagen/${archivo}`,
    fecha,
    prompt: ficha.prompt,
    modelo: ficha.modelo,
    calidad: ficha.calidad,
    tamano: ficha.tamano,
    origen: ficha.origen,
    promptRevisado: ficha.promptRevisado || null,
  };
}

export async function borrarImagen(id) {
  const { data: fila } = await supabase.from("imagenes").select("archivo").eq("id", id).single();
  if (!fila) return false;

  await supabase.storage.from(BUCKET).remove([fila.archivo]);
  const { error } = await supabase.from("imagenes").delete().eq("id", id);
  if (error) return false;

  return true;
}

/**
 * Llama a la API de OpenAI y devuelve { ok, estado, datos, mensaje }.
 * Nunca lanza: los errores viajan como datos para poder mostrarlos en pantalla.
 */
export async function llamarOpenAI(ruta, opciones = {}) {
  if (!key()) {
    return {
      ok: false,
      estado: 500,
      mensaje: "Falta la API key. Copiá .env.ejemplo a .env.local, pegá tu key y reiniciá el servidor.",
    };
  }

  let respuesta, crudo;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${key()}`, ...(opciones.headers || {}) },
    });
    crudo = await respuesta.text();
  } catch (e) {
    return { ok: false, estado: 502, mensaje: `No se pudo contactar a OpenAI: ${e.message}` };
  }

  let datos;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return {
      ok: false,
      estado: 502,
      mensaje: `OpenAI respondió algo que no es JSON (código ${respuesta.status}). Revisá la conexión o el proxy de red.`,
      detalle: crudo.slice(0, 300),
    };
  }

  if (!respuesta.ok) {
    return {
      ok: false,
      estado: respuesta.status,
      mensaje: datos?.error?.message || `OpenAI respondió ${respuesta.status}.`,
      detalle: datos?.error || null,
    };
  }

  return { ok: true, estado: 200, datos };
}

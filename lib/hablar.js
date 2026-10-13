import { VOCES } from "@/lib/config";

/**
 * Lo que hace falta del lado del navegador para la pestaña "Hablar". Una "entrada"
 * (imagen/video base o audio) es una de dos cosas:
 *  - { fuente: "galeria", archivo, vista, ext, nombre } — ya está en el bucket.
 *  - { fuente: "subida", file, vista, ext, nombre }     — recién elegida de la compu.
 * `vista` es la URL para previsualizarla (/api/imagen/... o un blob:), y el audio suma
 * `duracion` en segundos cuando el navegador termina de leer los metadatos.
 */

export const HABLAR_INICIAL = {
  base: null,
  audio: null,
  fuenteAudio: "archivo", // "archivo" | "texto"
  texto: "",
  voz: VOCES[0].id,
  velocidad: 1,
  resolucion: "480p",
  modo: "lite",
};

// En Vercel el cuerpo de un pedido no puede pasar de ~4.5MB: lo que pese más va
// directo del navegador al bucket con una URL firmada, sin pasar por nuestra API.
const LIMITE_API = 4 * 1024 * 1024;
const MB = 1024 * 1024;

export function extDe(nombre = "") {
  const ext = nombre.split("?")[0].split(".").pop().toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

export function entradaDesdeFicha(ficha) {
  return { fuente: "galeria", archivo: ficha.archivo, vista: ficha.url, ext: extDe(ficha.archivo), nombre: ficha.prompt || ficha.archivo };
}

export function entradaDesdeArchivo(file) {
  return { fuente: "subida", file, vista: URL.createObjectURL(file), ext: extDe(file.name), nombre: file.name };
}

/** Devuelve el motivo por el que no se puede generar todavía, o null si está todo bien. */
export function validarHablar(entrada, h) {
  const queBase = entrada.base === "video" ? "un video" : "una imagen";
  if (!h.base) return `Elegí ${queBase} base (paso 1).`;
  if (!entrada.formatosBase.includes(h.base.ext)) {
    return `${entrada.nombre} no acepta .${h.base.ext}: usá ${entrada.formatosBase.join(", ")}.`;
  }
  const maxBase = entrada.base === "video" ? 500 : 10;
  if (h.base.file && h.base.file.size > maxBase * MB) return `La base pesa más de ${maxBase}MB, el tope de ${entrada.nombre}.`;

  if (!h.audio) return "Falta el audio (paso 2): subí un mp3/wav o generá una voz.";
  const maxAudio = entrada.maxMbAudio || 10;
  if (h.audio.file && h.audio.file.size > maxAudio * MB) return `El audio pesa más de ${maxAudio}MB, el tope de ${entrada.nombre}.`;

  const seg = h.audio.duracion;
  if (seg != null) {
    const max = entrada.id === "kie-volcengine-lipsync" && h.modo === "basic" ? 210 : entrada.maxSegundosAudio;
    if (entrada.minSegundosAudio && seg < entrada.minSegundosAudio) return `El audio tiene que durar más de ${entrada.minSegundosAudio}s.`;
    if (max && seg > max) return `El audio dura ${Math.round(seg)}s y ${entrada.nombre} acepta hasta ${max}s.`;
  }
  return null;
}

/** Deja la entrada lista para /api/hablar: `{ archivo }` si está en el bucket, `{ url }` si se subió a Kie. */
export async function subirEntrada(x) {
  if (x.fuente === "galeria") return { archivo: x.archivo };

  if (x.file.size <= LIMITE_API) {
    const forma = new FormData();
    forma.append("archivo", x.file);
    const r = await fetch("/api/subir", { method: "POST", body: forma });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || "No se pudo subir el archivo a Kie.");
    return { url: d.url };
  }

  const r = await fetch("/api/subir/firmar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ext: x.ext }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "No se pudo preparar la subida.");
  const subida = await fetch(d.signedUrl, { method: "PUT", headers: { "Content-Type": d.tipo }, body: x.file });
  if (!subida.ok) throw new Error(`Supabase rechazó la subida de ${x.nombre} (código ${subida.status}).`);
  return { archivo: d.archivo };
}

import { creditosClip } from "@/lib/proveedores";

/**
 * Lo que necesita la pestaña "Secuencia" del lado del navegador. Las imágenes son
 * "entradas" como las de lib/hablar.js ({ fuente, archivo | file, vista, ext, nombre }),
 * más un `uid` para poder repetir la misma foto y reordenarlas sin confundir las claves.
 */

export const MIN_IMAGENES = 2;
export const MAX_IMAGENES = 8;

export const SECUENCIA_INICIAL = {
  imagenes: [],
  prompt: "",
  calidad: "540p",
  duracion: 5,
  audio: false,
};

export const conUid = (entrada) => ({ ...entrada, uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });

export const nuevoIdSecuencia = () => `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Mueve el elemento `desde` a la posición `hasta` (para arrastrar y para los botones ← →). */
export function mover(lista, desde, hasta) {
  if (hasta < 0 || hasta >= lista.length || desde === hasta) return lista;
  const copia = [...lista];
  const [item] = copia.splice(desde, 1);
  copia.splice(hasta, 0, item);
  return copia;
}

/** Cuántos clips salen y cuánto cuestan en total (estimado): N imágenes → N-1 clips. */
export function resumenSecuencia(entrada, s) {
  const clips = Math.max(0, s.imagenes.length - 1);
  const porClip = creditosClip(entrada, s.calidad, s.duracion);
  return { clips, porClip, total: clips * porClip };
}

/** Motivo por el que todavía no se puede generar, o null. */
export function validarSecuencia(entrada, s) {
  const n = s.imagenes.length;
  if (n < MIN_IMAGENES) return `Cargá al menos ${MIN_IMAGENES} imágenes: con 2 sale un clip.`;
  if (n > MAX_IMAGENES) return `Son ${n} imágenes y el máximo es ${MAX_IMAGENES}.`;
  for (const [i, img] of s.imagenes.entries()) {
    if (!entrada.formatosBase.includes(img.ext)) return `La imagen ${i + 1} es .${img.ext}: PixVerse acepta ${entrada.formatosBase.join(", ")}.`;
    if (img.file && img.file.size > entrada.maxMbImagen * 1024 * 1024) return `La imagen ${i + 1} pesa más de ${entrada.maxMbImagen}MB.`;
  }
  return null;
}

/**
 * Baja los clips de una secuencia de a uno, con el nombre numerado (clip-01.mp4,
 * clip-02.mp4...). Chrome pide una sola vez permiso para descargar varios archivos.
 */
export async function descargarClips(clips) {
  for (const [i, clip] of clips.entries()) {
    const respuesta = await fetch(clip.url);
    if (!respuesta.ok) throw new Error(`No se pudo bajar el clip ${i + 1} (código ${respuesta.status}).`);
    const url = URL.createObjectURL(await respuesta.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `clip-${String(clip.secuenciaOrden ?? i + 1).padStart(2, "0")}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    // Una pausa corta entre descargas: sin esto el navegador descarta algunas.
    await new Promise((r) => setTimeout(r, 400));
  }
}

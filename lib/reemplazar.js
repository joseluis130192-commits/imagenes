import { creditosReemplazo } from "@/lib/proveedores";

/**
 * Lo que necesita la pestaña "Reemplazar" del lado del navegador. El video y la imagen
 * son "entradas" como las de lib/hablar.js; el video suma `duracion` (segundos) cuando
 * el navegador termina de leer sus metadatos.
 */

export const REEMPLAZAR_INICIAL = {
  modo: "replace",
  video: null,
  imagen: null,
  resolucion: "480p",
};

const MB = 1024 * 1024;

/** Motivo por el que todavía no se puede generar, o null. */
export function validarReemplazo(entrada, r) {
  const modo = entrada.modos[r.modo];
  if (!r.video) return "Falta el video base (paso 1).";
  if (!entrada.formatosVideo.includes(r.video.ext)) {
    return `El video es .${r.video.ext}: este modelo acepta ${entrada.formatosVideo.join(" o ")}.`;
  }
  if (r.video.file && r.video.file.size > modo.maxMbVideo * MB) {
    return `El video pesa ${(r.video.file.size / MB).toFixed(1)}MB y ${modo.nombre} acepta hasta ${modo.maxMbVideo}MB: comprimilo o recortalo.`;
  }
  if (r.video.duracion == null) return "Esperá a que se lea la duración del video.";
  if (r.video.duracion > entrada.maxSegundosVideo) {
    return `El video dura ${r.video.duracion.toFixed(1)}s: recortalo a ${entrada.maxSegundosVideo}s o menos. Este modelo no sirve para escenas largas.`;
  }

  if (!r.imagen) return "Falta la imagen del personaje (paso 2).";
  if (!entrada.formatosImagen.includes(r.imagen.ext)) {
    return `La imagen es .${r.imagen.ext}: usá ${entrada.formatosImagen.filter((f) => f !== "jpeg").join(", ")}.`;
  }
  if (r.imagen.file && r.imagen.file.size > modo.maxMbImagen * MB) {
    return `La imagen pesa más de ${modo.maxMbImagen}MB, el tope de ${modo.nombre}.`;
  }
  if (!modo.resoluciones.includes(r.resolucion)) return `${modo.nombre} no ofrece ${r.resolucion}.`;
  return null;
}

/** Costo de la tanda con los ajustes actuales (null hasta que se conoce la duración). */
export function costoReemplazo(entrada, r) {
  return creditosReemplazo(entrada, r.modo, r.resolucion, r.video?.duracion);
}

/** "3:12" a partir de milisegundos. */
export function reloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Registro declarativo de modelos de Kie AI. Agregar un modelo nuevo es agregar una
 * entrada acá — nunca hace falta tocar las rutas de generar/editar/tarea.
 *
 * Solo algunos definen `generar` (los que sí pueden crear una imagen desde cero); los
 * que exigen una imagen de entrada (Recraft, Topaz, el segment-map de Grok) solo tienen
 * `editar`, y por eso no aparecen en el selector cuando el modo es "Generar".
 *
 * Cada sub-objeto `generar`/`editar` tiene:
 *  - `model`: el id exacto que espera Kie en POST /jobs/createTask.
 *  - `campoImagenes`: el nombre del campo de `input` que lleva la(s) referencia(s)
 *    (un array como "input_urls", o un string como "image" — solo documentación, no lo
 *    lee ningún código; quien sí lo necesita para distinguir origen es la lista aparte
 *    en app/api/tarea/[taskId]/route.js).
 *  - `armarInput(prompt, tamano, urls, formato, calidad)`: arma el objeto `input`
 *    mapeando nuestros controles a los valores que Kie espera. La mayoría ignora
 *    `calidad` (queda oculta para esos modelos); Seedream 5 Lite es el único que la usa.
 *
 * `controles` declara qué controles del panel aplican a este modelo, para que
 * Controles.js sepa qué esconder. `grupo` agrupa el selector por uso, no por proveedor:
 * "Realista", "Edición", "Económicos", "Retoque"; en video, "Económicos" o "Calidad alta"
 * (ver el bloque de video, que además lleva su tabla `costos`); "Hablar" (lipsync), "Voz"
 * (texto→voz) o "Secuencia" (transiciones entre fotos). `nota` es la línea que se muestra
 * debajo del selector cuando ese modelo está elegido. `creditos` es una estimación: casi
 * ningún modelo de Kie publica un número exacto (la excepción es Recraft, que sí dice
 * "1 crédito"), así que conviene revisar el saldo real después de las primeras tareas y
 * ajustar acá. Ojo: las primeras estimaciones puestas a ojo (basadas en "10-50 créditos
 * típico" de la doc general) resultaron muy altas — Flux-2 Pro y Z-Image, ya probados con
 * tareas reales, gastaron 5 y 0.8 créditos respectivamente, no 40 y 8.
 */

const TAMANO_A_ASPECTO = {
  "1024x1024": "1:1",
  "1024x1536": "2:3",
  "1536x1024": "3:2",
};

const ASPECTO_A_TAMANO = {
  "1:1": "1024x1024",
  "2:3": "1024x1536",
  "3:2": "1536x1024",
};

/** `permiteAuto`: algunos modelos (Flux-2 Pro texto→imagen) no aceptan "auto". */
function aspectoDesdeTamano(tamano, permiteAuto) {
  if (tamano === "auto") return permiteAuto ? "auto" : "1:1";
  return TAMANO_A_ASPECTO[tamano] || "1:1";
}

/** Inverso: para que la Galería siga calculando bien la proporción con proporcionDe(). */
export function tamanoDesdeAspecto(aspecto) {
  return ASPECTO_A_TAMANO[aspecto] || "auto";
}

/** Ideogram no usa aspect_ratio sino `image_size` con nombres propios, y no tiene 2:3/3:2. */
function tamanoIdeogram(tamano) {
  if (tamano === "1024x1536") return "portrait_4_3"; // vertical más cercano (3:4)
  if (tamano === "1536x1024") return "landscape_4_3"; // horizontal más cercano
  return "square_hd";
}

/** Nuestras calidades → `rendering_speed` de Ideogram. */
function velocidadIdeogram(calidad) {
  return { low: "TURBO", high: "QUALITY" }[calidad] || "BALANCED";
}

/* ---------------------------------------------------------- costos de video */

/** Clave de una combinación en la tabla `costos` de un modelo de video: "5s·720p·sin". */
export function claveCosto(duracion, resolucion, audio = false) {
  return `${duracion}s·${resolucion || "-"}·${audio ? "con" : "sin"}`;
}

/**
 * Tabla de costos a partir de un precio por segundo de cada resolución. Con
 * `mismoPrecioConAudio` suma también las combinaciones con audio, al mismo precio.
 */
function tablaPorSegundo(duraciones, porSegundo, { mismoPrecioConAudio = false } = {}) {
  const tabla = {};
  for (const d of duraciones) {
    for (const [res, cps] of Object.entries(porSegundo)) {
      const creditos = Math.round(cps * d * 10) / 10;
      tabla[claveCosto(d, res)] = creditos;
      if (mismoPrecioConAudio) tabla[claveCosto(d, res, true)] = creditos;
    }
  }
  return tabla;
}

/** Todas las combinaciones de un modelo, con precio sin confirmar (null). */
function tablaSinConfirmar(duraciones, resoluciones, conAudio) {
  const tabla = {};
  for (const d of duraciones) {
    for (const res of resoluciones) {
      tabla[claveCosto(d, res)] = null;
      if (conAudio) tabla[claveCosto(d, res, true)] = null;
    }
  }
  return tabla;
}

/**
 * Costo de UNA tarea de video con los ajustes elegidos. Devuelve { creditos, disponible }:
 * `creditos` es null si el precio no está confirmado, y `disponible` es false si el
 * modelo no ofrece esa combinación (ej. Hailuo 10s en 1080p).
 */
export function costoVideo(entrada, { duracion, resolucion, sonido }) {
  const cv = entrada?.controlesVideo || {};
  const clave = claveCosto(duracion, cv.resolucionesPermitidas ? resolucion : null, cv.sonido ? sonido === true : false);
  if (!entrada?.costos) return { creditos: null, disponible: true };
  if (!(clave in entrada.costos)) return { creditos: null, disponible: false };
  return { creditos: entrada.costos[clave], disponible: true };
}

/** La combinación más barata de un modelo de video: duración mínima, resolución más baja, sin audio. */
export function ajustesMasBaratos(entrada) {
  const cv = entrada?.controlesVideo || {};
  return {
    duracion: Math.min(...(cv.duracionesPermitidas || [5])),
    ...(cv.resolucionesPermitidas ? { resolucion: cv.resolucionesPermitidas[0] } : {}),
    sonido: false,
  };
}

/** "20 cr", "desde 20 cr" o "costo sin confirmar", para el selector. */
export function etiquetaCostoVideo(entrada) {
  const minimo = costoVideo(entrada, ajustesMasBaratos(entrada)).creditos;
  if (minimo == null) return "costo sin confirmar";
  const varios = new Set(Object.values(entrada.costos)).size > 1;
  return `${varios ? "desde " : ""}${formatoCreditos(minimo)} cr`;
}

export function formatoCreditos(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Z-Image no acepta 2:3/3:2/auto (solo 1:1, 4:3, 3:4, 16:9, 9:16): mapeo aparte. */
function aspectoZImage(tamano) {
  if (tamano === "1024x1536") return "3:4"; // vertical más cercano
  if (tamano === "1536x1024") return "4:3"; // horizontal más cercano
  return "1:1";
}

export const MODELOS_KIE = [
  {
    id: "kie-flux2-pro",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Flux-2 Pro",
    grupo: "Realista",
    nota: "el más prolijo para fotos realistas, con buen control de encuadre",
    creditos: 5, // confirmado con una tarea real: creditsConsumed devolvió 5.0
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    generar: {
      model: "flux-2/pro-text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, false),
        resolution: "1K",
      }),
    },
    editar: {
      model: "flux-2/pro-image-to-image",
      campoImagenes: "input_urls",
      armarInput: (prompt, tamano, urls) => ({
        prompt,
        input_urls: urls,
        aspect_ratio: aspectoDesdeTamano(tamano, true),
        resolution: "1K",
      }),
    },
  },
  {
    id: "kie-nanobanana2",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Nano Banana 2",
    grupo: "Realista",
    nota: "el más versátil: genera y edita bien con instrucciones en lenguaje natural",
    creditos: 5, // estimado igual a Flux-2 Pro (misma categoría); no confirmado con una tarea real todavía
    controles: { calidad: false, cantidad: false, formato: true, formatosPermitidos: ["png", "jpeg"], fondo: false },
    generar: {
      model: "nano-banana-2",
      campoImagenes: null,
      armarInput: (prompt, tamano, _urls, formato) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, true),
        resolution: "1K",
        output_format: formato === "jpeg" ? "jpg" : "png",
      }),
    },
    editar: {
      model: "google/nano-banana-edit",
      campoImagenes: "image_urls",
      armarInput: (prompt, tamano, urls, formato) => ({
        prompt,
        image_urls: urls,
        aspect_ratio: aspectoDesdeTamano(tamano, true),
        output_format: formato === "jpeg" ? "jpeg" : "png",
      }),
    },
  },
  {
    id: "kie-seedream5-pro",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Seedream 5.0 Pro",
    grupo: "Realista",
    nota: "realista, fuerte con personas; falla distinto que Flux",
    creditos: 7, // la doc no publica precio: 7 es el creditsConsumed de su ejemplo (1 imagen, basic)
    controles: { calidad: true, cantidad: false, formato: true, formatosPermitidos: ["png", "jpeg"], fondo: false },
    // aspect_ratio y quality son obligatorios; aspect_ratio no acepta "auto". quality:
    // "basic" sale en 1K y "high" en 2K.
    generar: {
      model: "seedream/5-pro-text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano, _urls, formato, calidad) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, false),
        quality: calidad === "high" ? "high" : "basic",
        output_format: formato === "jpeg" ? "jpeg" : "png",
      }),
    },
    // Hasta 10 referencias; la primera es gratis y cada una de más suma costo.
    editar: {
      model: "seedream/5-pro-image-to-image",
      campoImagenes: "image_urls",
      armarInput: (prompt, tamano, urls, formato, calidad) => ({
        prompt,
        image_urls: urls.slice(0, 10),
        aspect_ratio: aspectoDesdeTamano(tamano, false),
        quality: calidad === "high" ? "high" : "basic",
        output_format: formato === "jpeg" ? "jpeg" : "png",
      }),
    },
  },
  {
    id: "kie-ideogram-v3",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Ideogram V3",
    grupo: "Realista",
    nota: "el que mejor escribe texto dentro de la imagen",
    creditos: 7, // la doc no publica precio: 7 es el creditsConsumed de su ejemplo
    // Sale siempre en WebP: no hay formato para elegir. La calidad se mapea a rendering_speed.
    controles: { calidad: true, cantidad: false, formato: false, fondo: false },
    generar: {
      model: "ideogram/v3-text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano, _urls, _formato, calidad) => ({
        prompt,
        image_size: tamanoIdeogram(tamano),
        rendering_speed: velocidadIdeogram(calidad),
        style: "AUTO",
        expand_prompt: false, // sin MagicPrompt: el texto pedido tiene que salir tal cual
      }),
    },
  },
  {
    id: "kie-flux2-flex",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Flux-2 Flex",
    grupo: "Económicos",
    nota: "versión más barata de Flux-2 Pro, buena para iterar antes de la definitiva",
    creditos: 3, // estimado: Flex es la variante barata de Pro (5 confirmados)
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    generar: {
      model: "flux-2/flex-text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, false),
        resolution: "1K",
      }),
    },
    editar: {
      model: "flux-2/flex-image-to-image",
      campoImagenes: "input_urls",
      armarInput: (prompt, tamano, urls) => ({
        prompt,
        input_urls: urls,
        aspect_ratio: aspectoDesdeTamano(tamano, true),
        resolution: "1K",
      }),
    },
  },
  {
    id: "kie-grok-imagine2",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Grok Imagine 2.0",
    grupo: "Edición",
    nota: "bueno para ediciones creativas guiadas por instrucciones de texto",
    creditos: 3, // estimado, no publicado
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    generar: {
      model: "grok-imagine-image-2-0/text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, false),
      }),
    },
    editar: {
      model: "grok-imagine-image-2-0/image-edit",
      campoImagenes: "image_urls",
      armarInput: (prompt, tamano, urls) => ({
        prompt,
        image_urls: urls,
        aspect_ratio: aspectoDesdeTamano(tamano, true),
      }),
    },
  },
  {
    id: "kie-ideogram-character",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Ideogram Character",
    grupo: "Edición",
    nota: "para mantener la misma persona entre varias imágenes",
    creditos: 18, // la doc no publica precio: 18 es el creditsConsumed de su ejemplo
    controles: { calidad: true, cantidad: false, formato: false, fondo: false },
    // Solo editar: necesita la foto de la persona. Acepta una sola referencia (maxItems: 1),
    // así que si se suben varias se usa la primera. Sale en WebP.
    editar: {
      model: "ideogram/character",
      campoImagenes: "reference_image_urls",
      armarInput: (prompt, tamano, urls, _formato, calidad) => ({
        prompt,
        reference_image_urls: urls.slice(0, 1),
        image_size: tamanoIdeogram(tamano),
        rendering_speed: velocidadIdeogram(calidad),
        style: "AUTO",
        num_images: "1",
      }),
    },
  },
  {
    id: "kie-grok-segmentmap",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Grok Segment Map",
    grupo: "Retoque",
    nota: "identifica y separa zonas puntuales de una foto antes de retocarlas",
    creditos: 1, // estimado: es una herramienta utilitaria, no un generador completo
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    // Solo editar: no genera nada desde cero, necesita una imagen de entrada.
    editar: {
      model: "grok-imagine-image-2-0/segment-map",
      campoImagenes: "image_url",
      // Este modelo no usa prompt ni aspect_ratio: solo la imagen.
      armarInput: (_prompt, _tamano, urls) => ({
        image_url: urls[0],
      }),
    },
  },
  {
    id: "kie-z-image",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Z-Image",
    grupo: "Económicos",
    nota: "el más barato, para probar prompts antes de repetir en uno caro",
    creditos: 1, // confirmado con una tarea real: creditsConsumed devolvió 0.8
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    generar: {
      model: "z-image",
      campoImagenes: null,
      armarInput: (prompt, tamano) => ({
        prompt,
        aspect_ratio: aspectoZImage(tamano),
      }),
    },
  },
  {
    id: "kie-seedream5-lite",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Seedream 5 Lite",
    grupo: "Económicos",
    nota: "la versión barata de Seedream, para iterar",
    creditos: 2, // estimado, no publicado
    controles: { calidad: true, cantidad: false, formato: true, formatosPermitidos: ["png", "jpeg"], fondo: false },
    generar: {
      model: "seedream/5-lite-text-to-image",
      campoImagenes: null,
      armarInput: (prompt, tamano, _urls, formato, calidad) => ({
        prompt,
        aspect_ratio: aspectoDesdeTamano(tamano, false),
        quality: { low: "basic", medium: "high", high: "ultra", auto: "basic" }[calidad] || "basic",
        output_format: formato === "jpeg" ? "jpeg" : "png",
      }),
    },
  },
  {
    id: "kie-recraft-removebg",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Recraft Quitar Fondo",
    grupo: "Retoque",
    nota: "recorta el fondo",
    creditos: 1, // la doc no publica precio: 1 es el creditsConsumed de su ejemplo. Entrada: máx. 5MB, 256–4096px
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    editar: {
      model: "recraft/remove-background",
      campoImagenes: "image",
      armarInput: (_prompt, _tamano, urls) => ({
        image: urls[0],
      }),
    },
  },
  {
    id: "kie-topaz-upscale",
    proveedor: "kie",
    tipo: "imagen",
    nombre: "Topaz Upscale",
    grupo: "Retoque",
    nota: "amplía y recupera detalle, útil para caras blandas",
    creditos: 10, // la doc no publica precio: 10 es el creditsConsumed de su ejemplo
    controles: { calidad: false, cantidad: false, formato: false, fondo: false },
    editar: {
      model: "topaz/image-upscale",
      campoImagenes: "image_url",
      armarInput: (_prompt, _tamano, urls) => ({
        image_url: urls[0],
        upscale_factor: "2",
      }),
    },
  },
  /*
   * Video. Cada entrada lleva `costos`: el precio en créditos de CADA combinación de
   * duración, resolución y audio, con la clave de claveCosto() ("5s·720p·sin"). Una
   * combinación que no está en la tabla es que el modelo no la ofrece; una que vale null
   * es que existe pero su precio no está confirmado. `costos: null` = todo sin confirmar.
   * Fuente de cada número al lado: la doc de Kie no publica precios (todas muestran el
   * mismo creditsConsumed de ejemplo, 1.23), así que salen de kie.ai/pricing o de la
   * página de cada modelo en kie.ai, o de una tarea real. 200 créditos = 1 USD.
   *
   * `grupo` es "Económicos" o "Calidad alta"; dentro de cada grupo el selector los
   * ordena de más barato a más caro según la combinación más barata (ajustesMasBaratos).
   * `resolucionesPermitidas` va siempre de menor a mayor: la primera es la más barata.
   */
  {
    id: "kie-seedance-v1-lite",
    proveedor: "kie",
    tipo: "video",
    nombre: "Seedance V1 Lite",
    grupo: "Económicos",
    nota: "el más barato de todos; bueno para probar el movimiento antes de pagar uno mejor",
    // kie.ai/bytedance/seedance-v1: 2 / 4.5 / 10 créditos por segundo en 480p / 720p / 1080p.
    costos: tablaPorSegundo([5, 10], { "480p": 2, "720p": 4.5, "1080p": 10 }),
    controlesVideo: { duracionesPermitidas: [5, 10], resolucionesPermitidas: ["480p", "720p", "1080p"], sonido: false },
    editar: {
      model: "bytedance/v1-lite-image-to-video",
      campoImagenes: "image_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        image_url: urls[0],
        resolution: video?.resolucion || "480p",
        duration: String(video?.duracion || 5),
      }),
    },
  },
  {
    id: "kie-seedance2-mini",
    proveedor: "kie",
    tipo: "video",
    nombre: "Seedance 2 Mini",
    grupo: "Económicos",
    nota: "Seedance 2 en versión barata: texto o imagen, con aspecto elegible",
    // kie.ai/seedance-2-0-mini, precio "no video" (sin video de referencia, que es nuestro
    // caso): 3.8 créd/s en 480p y 8.2 en 720p. El audio no tiene precio aparte.
    // Confirmado con una tarea real: imagen→video 4s 480p sin audio → creditsConsumed 15.2.
    costos: tablaPorSegundo([4, 5, 10, 15], { "480p": 3.8, "720p": 8.2 }, { mismoPrecioConAudio: true }),
    controlesVideo: {
      duracionesPermitidas: [4, 5, 10, 15],
      resolucionesPermitidas: ["480p", "720p"],
      aspectosPermitidos: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      sonido: true,
    },
    generar: {
      model: "bytedance/seedance-2-mini",
      campoImagenes: null,
      armarInput: (prompt, _tamano, _urls, _formato, _calidad, video) => ({
        prompt,
        resolution: video?.resolucion || "480p",
        aspect_ratio: video?.aspecto || "16:9",
        duration: video?.duracion || 4,
        generate_audio: video?.sonido === true,
      }),
    },
    // Mismo model id: con first_frame_url pasa a imagen→video. "adaptive" toma el aspecto de la foto.
    editar: {
      model: "bytedance/seedance-2-mini",
      campoImagenes: "first_frame_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        first_frame_url: urls[0],
        resolution: video?.resolucion || "480p",
        aspect_ratio: "adaptive",
        duration: video?.duracion || 4,
        generate_audio: video?.sonido === true,
      }),
    },
  },
  {
    id: "kie-seedance-v1-pro-fast",
    proveedor: "kie",
    tipo: "video",
    nombre: "Seedance V1 Pro Fast",
    grupo: "Económicos",
    nota: "más prolijo que V1 Lite y rápido; arranca en 720p",
    // kie.ai/seedance-1-0-pro-fast: 720P 16 (5s) / 36 (10s); 1080P 36 (5s) / 72 (10s).
    costos: {
      [claveCosto(5, "720p")]: 16,
      [claveCosto(10, "720p")]: 36,
      [claveCosto(5, "1080p")]: 36,
      [claveCosto(10, "1080p")]: 72,
    },
    controlesVideo: { duracionesPermitidas: [5, 10], resolucionesPermitidas: ["720p", "1080p"], sonido: false },
    editar: {
      model: "bytedance/v1-pro-fast-image-to-video",
      campoImagenes: "image_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        image_url: urls[0],
        resolution: video?.resolucion || "720p",
        duration: String(video?.duracion || 5),
      }),
    },
  },
  {
    id: "kie-wan26-flash",
    proveedor: "kie",
    tipo: "video",
    nombre: "Wan 2.6 Flash",
    grupo: "Económicos",
    nota: "imagen→video rápido, hasta 15s; el audio duplica el precio",
    // kie.ai/pricing (tabla de Wan 2.6 Flash image-to-video), sin audio / con audio:
    costos: {
      [claveCosto(5, "720p")]: 20,
      [claveCosto(5, "720p", true)]: 40,
      [claveCosto(5, "1080p")]: 30,
      [claveCosto(5, "1080p", true)]: 60,
      [claveCosto(10, "720p")]: 40,
      [claveCosto(10, "720p", true)]: 80,
      [claveCosto(10, "1080p")]: 60,
      [claveCosto(10, "1080p", true)]: 120,
      [claveCosto(15, "720p")]: 60,
      [claveCosto(15, "720p", true)]: 120,
      [claveCosto(15, "1080p")]: 90,
      [claveCosto(15, "1080p", true)]: 180,
    },
    controlesVideo: { duracionesPermitidas: [5, 10, 15], resolucionesPermitidas: ["720p", "1080p"], sonido: true },
    editar: {
      model: "wan/2-6-flash-image-to-video",
      campoImagenes: "image_urls",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt: prompt.slice(0, 1500),
        image_urls: urls.slice(0, 1),
        duration: String(video?.duracion || 5),
        resolution: video?.resolucion || "720p",
        audio: video?.sonido === true, // la doc lo marca obligatorio: siempre se manda
      }),
    },
  },
  {
    id: "kie-hailuo23",
    proveedor: "kie",
    tipo: "video",
    nombre: "Hailuo 2.3 Standard",
    grupo: "Económicos",
    nota: "buen movimiento de personas; clips de 6 o 10s (10s solo en 768p)",
    // kie.ai/hailuo-2-3: 6s 768P 30, 10s 768P 50, 6s 1080P 50. 10s en 1080P no existe
    // (la doc: "10 seconds videos are not supported for 1080p"), por eso no está en la tabla.
    costos: {
      [claveCosto(6, "768p")]: 30,
      [claveCosto(10, "768p")]: 50,
      [claveCosto(6, "1080p")]: 50,
    },
    controlesVideo: { duracionesPermitidas: [6, 10], resolucionesPermitidas: ["768p", "1080p"], sonido: false },
    editar: {
      model: "hailuo/2-3-image-to-video-standard",
      campoImagenes: "image_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        image_url: urls[0],
        duration: String(video?.duracion || 6),
        resolution: video?.resolucion === "1080p" ? "1080P" : "768P", // la doc los pide en mayúscula
      }),
    },
  },
  {
    id: "kie-kling-video",
    proveedor: "kie",
    tipo: "video",
    nombre: "Kling 2.6",
    grupo: "Calidad alta",
    nota: "el mejor para escenas con movimiento natural y cámara estable",
    // kie.ai/kling-2-6: 5s 55 / 10s 110 sin audio; 5s 110 / 10s 220 con audio.
    costos: {
      [claveCosto(5, null)]: 55,
      [claveCosto(10, null)]: 110,
      [claveCosto(5, null, true)]: 110,
      [claveCosto(10, null, true)]: 220,
    },
    controlesVideo: {
      duracionesPermitidas: [5, 10],
      aspectosPermitidos: ["1:1", "16:9", "9:16"],
      sonido: true,
    },
    // texto -> video
    generar: {
      model: "kling-2.6/text-to-video",
      campoImagenes: null,
      armarInput: (prompt, _tamano, _urls, _formato, _calidad, video) => ({
        prompt,
        duration: String(video?.duracion || 5),
        aspect_ratio: video?.aspecto || "16:9",
        sound: video?.sonido === true,
      }),
    },
    // imagen -> video: hereda el aspecto de la imagen de referencia, por eso no manda aspect_ratio
    editar: {
      model: "kling-2.6/image-to-video",
      campoImagenes: "image_urls",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        image_urls: urls,
        duration: String(video?.duracion || 5),
        sound: video?.sonido === true,
      }),
    },
  },
  {
    id: "kie-wan25",
    proveedor: "kie",
    tipo: "video",
    nombre: "Wan 2.5",
    grupo: "Calidad alta",
    nota: "imagen→video con prompt negativo y reescritura opcional del prompt",
    // kie.ai/wan-2-5: 12 créditos por segundo en 720p y 20 en 1080p.
    costos: tablaPorSegundo([5, 10], { "720p": 12, "1080p": 20 }),
    controlesVideo: { duracionesPermitidas: [5, 10], resolucionesPermitidas: ["720p", "1080p"], sonido: false },
    editar: {
      model: "wan/2-5-image-to-video",
      campoImagenes: "image_url",
      // duration y resolution son obligatorios en este modelo.
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt: prompt.slice(0, 800),
        image_url: urls[0],
        duration: String(video?.duracion || 5),
        resolution: video?.resolucion || "720p",
      }),
    },
  },
  {
    id: "kie-seedance2",
    proveedor: "kie",
    tipo: "video",
    nombre: "Seedance 2",
    grupo: "Calidad alta",
    nota: "el Seedance completo, hasta 1080p",
    // Costo sin confirmar: kie.ai/seedance-2-0 muestra 11.7 créd/s (480p) y 24.8 (720p)
    // pero mezclado con Seedance 2 Fast, y no coincide con lo real. Lo único confirmado
    // es una tarea real: 4s, 480p, con audio → creditsConsumed 76.
    costos: {
      ...tablaSinConfirmar([4, 5, 10, 15], ["480p", "720p", "1080p"], true),
      [claveCosto(4, "480p", true)]: 76,
    },
    controlesVideo: {
      duracionesPermitidas: [4, 5, 10, 15],
      resolucionesPermitidas: ["480p", "720p", "1080p"],
      aspectosPermitidos: ["1:1", "4:3", "3:4", "16:9", "9:16"],
      sonido: true,
    },
    // texto -> video
    generar: {
      model: "bytedance/seedance-2",
      campoImagenes: null,
      armarInput: (prompt, _tamano, _urls, _formato, _calidad, video) => ({
        prompt,
        duration: video?.duracion || 4,
        aspect_ratio: video?.aspecto || "16:9",
        resolution: video?.resolucion || "480p",
        generate_audio: video?.sonido === true,
      }),
    },
    // imagen -> video: misma model id, solo suma first_frame_url
    editar: {
      model: "bytedance/seedance-2",
      campoImagenes: "first_frame_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        first_frame_url: urls[0],
        duration: video?.duracion || 4,
        aspect_ratio: video?.aspecto || "16:9",
        resolution: video?.resolucion || "480p",
        generate_audio: video?.sonido === true,
      }),
    },
  },
  {
    id: "kie-kling21-standard",
    proveedor: "kie",
    tipo: "video",
    nombre: "Kling 2.1 Standard",
    grupo: "Calidad alta",
    nota: "imagen→video con control de cuánto sigue al prompt (solo jpg o png)",
    // Costo sin confirmar: kie.ai/kling/v2-1 muestra una sola tarjeta (160 créditos 5s,
    // 320 10s) sin decir si es Standard, Pro o Master.
    costos: null,
    controlesVideo: { duracionesPermitidas: [5, 10], sonido: false },
    editar: {
      model: "kling/v2-1-standard",
      campoImagenes: "image_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        image_url: urls[0],
        duration: String(video?.duracion || 5),
      }),
    },
  },

  /*
   * Lipsync (pestaña "Hablar"). En vez de `generar`/`editar` tienen `hablar`, y por eso
   * no aparecen en los selectores de las otras pestañas. `base` dice qué pide el
   * formulario en el paso 1: una imagen o un video. Ninguno publica precio: los
   * `creditosPorSegundo` (de audio, que es lo que define el largo del video) son
   * estimaciones a calibrar con creditsConsumed.
   */
  {
    id: "kie-infinitalk",
    proveedor: "kie",
    tipo: "video",
    nombre: "Infinitalk",
    grupo: "Hablar",
    nota: "foto + audio → video hablando; el más barato para probar",
    base: "imagen",
    formatosBase: ["png", "jpg", "jpeg", "webp"],
    pidePrompt: true,
    resolucionesPermitidas: ["480p", "720p"],
    creditosPorSegundo: { "480p": 3, "720p": 12 }, // estimado, no publicado
    hablar: {
      model: "infinitalk/from-audio",
      armarInput: ({ prompt, urlBase, urlAudio, resolucion }) => ({
        image_url: urlBase,
        audio_url: urlAudio,
        prompt,
        resolution: resolucion === "720p" ? "720p" : "480p",
      }),
    },
  },
  {
    id: "kie-kling-avatar",
    proveedor: "kie",
    tipo: "video",
    nombre: "Kling Avatar Standard",
    grupo: "Hablar",
    nota: "avatar desde una foto, 720p; acepta audios de hasta 5 minutos",
    base: "imagen",
    formatosBase: ["png", "jpg", "jpeg"], // la doc no acepta webp
    maxSegundosAudio: 300,
    maxMbAudio: 100,
    pidePrompt: true,
    creditosPorSegundo: 8, // estimado, no publicado
    hablar: {
      model: "kling/ai-avatar-standard",
      armarInput: ({ prompt, urlBase, urlAudio }) => ({ image_url: urlBase, audio_url: urlAudio, prompt }),
    },
  },
  {
    id: "kie-kling-avatar-pro",
    proveedor: "kie",
    tipo: "video",
    nombre: "Kling Avatar Pro",
    grupo: "Hablar",
    nota: "lo mismo que Standard pero en 1080p",
    base: "imagen",
    formatosBase: ["png", "jpg", "jpeg"],
    maxSegundosAudio: 300,
    maxMbAudio: 100,
    pidePrompt: true,
    creditosPorSegundo: 16, // estimado, no publicado
    hablar: {
      model: "kling/ai-avatar-pro",
      armarInput: ({ prompt, urlBase, urlAudio }) => ({ image_url: urlBase, audio_url: urlAudio, prompt }),
    },
  },
  {
    id: "kie-volcengine-lipsync",
    proveedor: "kie",
    tipo: "video",
    nombre: "Volcengine Lip Sync",
    grupo: "Hablar",
    nota: "re-sincroniza la boca de un video existente con un audio nuevo",
    base: "video",
    formatosBase: ["mp4", "mov"],
    minSegundosAudio: 1,
    maxSegundosAudio: 240, // 240 en lite, 210 en basic
    pidePrompt: false,
    modosPermitidos: ["lite", "basic"],
    creditosPorSegundo: 4, // estimado, no publicado
    hablar: {
      model: "volcengine/video-to-video-lip-sync",
      armarInput: ({ urlBase, urlAudio, modo }) => ({
        mode: modo === "basic" ? "basic" : "lite",
        video_url: urlBase,
        audio_url: urlAudio,
      }),
    },
  },

  /*
   * Secuencia (pestaña "Secuencia"): un clip de transición por cada par de imágenes
   * consecutivas. Tiene `secuencia` en vez de `generar`/`editar`, así que no aparece en
   * los otros selectores. Sin aspect_ratio: el clip toma el de las imágenes.
   */
  {
    id: "kie-pixverse-transition",
    proveedor: "kie",
    tipo: "video",
    nombre: "PixVerse V6 Transition",
    grupo: "Secuencia",
    nota: "anima el paso de una foto a la siguiente, usando las dos como primer y último cuadro",
    formatosBase: ["png", "jpg", "jpeg", "webp"],
    maxMbImagen: 20,
    calidadesPermitidas: ["360p", "540p", "720p", "1080p"],
    duracionesPermitidas: [3, 5, 8, 10], // la doc acepta de 1 a 15 segundos
    // La doc no publica precio (el creditsConsumed de 1.23 de su ejemplo es de muestra).
    // 540p confirmado con una tarea real: 5s sin audio gastaron 28 créditos (5.6/s). Las
    // otras calidades son estimaciones escaladas desde ese número, sin confirmar.
    creditosPorSegundo: { "360p": 3.7, "540p": 5.6, "720p": 7.5, "1080p": 15 },
    secuencia: {
      model: "pixverse-v6/transition",
      armarInput: ({ prompt, primera, ultima, calidad, duracion, audio }) => ({
        prompt,
        first_frame_image_url: primera,
        last_frame_image_url: ultima,
        quality: calidad || "540p",
        duration: Number(duracion) || 5,
        generate_audio_switch: Boolean(audio),
      }),
    },
  },

  /* Texto → voz: entra por el mismo flujo de tareas y el resultado se guarda con tipo "audio". */
  {
    id: "kie-elevenlabs",
    proveedor: "kie",
    tipo: "audio",
    nombre: "ElevenLabs Multilingual v2",
    grupo: "Voz",
    creditosPorMilCaracteres: 12, // estimado, no publicado
    voz: {
      model: "elevenlabs/text-to-speech-multilingual-v2",
      // Sin language_code: la doc dice que este modelo devuelve error si se lo mandan.
      armarInput: ({ texto, voz, velocidad }) => ({
        text: texto,
        voice: voz,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speed: Math.min(1.2, Math.max(0.7, Number(velocidad) || 1)),
      }),
    },
  },
];

export function buscarModeloKie(id) {
  return MODELOS_KIE.find((m) => m.id === id) || null;
}

/** Deduce si el resultado de una tarea de Kie es imagen, video o audio a partir del `model` que Kie devuelve. */
export function tipoDesdeModeloKie(modeloKie) {
  const entrada = MODELOS_KIE.find((m) =>
    [m.generar, m.editar, m.hablar, m.voz, m.secuencia].some((s) => s?.model === modeloKie)
  );
  return entrada?.tipo || "imagen";
}

/** Créditos estimados de un clip de secuencia (cada par de imágenes es un clip). */
export function creditosClip(entrada, calidad, duracion) {
  return Math.ceil((entrada?.creditosPorSegundo?.[calidad] || 0) * (Number(duracion) || 0));
}

/** Créditos estimados de una tarea de lipsync según el largo del audio. */
export function creditosHablar(entrada, segundos, resolucion) {
  const cps = entrada?.creditosPorSegundo;
  const porSegundo = typeof cps === "object" ? cps[resolucion] ?? Object.values(cps)[0] : cps || 0;
  return Math.ceil(porSegundo * (segundos || 0));
}

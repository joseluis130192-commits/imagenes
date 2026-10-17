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
 * "Realista", "Edición", "Económicos", "Retoque", "Video", "Hablar" (lipsync), "Voz"
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
  {
    id: "kie-kling-video",
    proveedor: "kie",
    tipo: "video",
    nombre: "Kling 2.6",
    grupo: "Video",
    nota: "el mejor para escenas con movimiento natural y cámara estable",
    creditos: 40, // estimado a ojo, no publicado por Kie: revisar con creditsConsumed real
    controlesVideo: {
      duracionesPermitidas: [5, 10],
      aspectosPermitidos: ["1:1", "16:9", "9:16"],
      resolucion: false, // Kling no expone resolución como parámetro
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
        sound: video?.sonido !== false,
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
        sound: video?.sonido !== false,
      }),
    },
  },
  {
    id: "kie-seedance2",
    proveedor: "kie",
    tipo: "video",
    nombre: "Seedance 2",
    grupo: "Video",
    nota: "el más barato de video: buena opción para probar antes de pagar Kling",
    creditos: 76, // confirmado con una tarea real (480p, 4s): creditsConsumed devolvió 76
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
        duration: video?.duracion || 5,
        aspect_ratio: video?.aspecto || "16:9",
        resolution: video?.resolucion || "720p",
        generate_audio: video?.sonido !== false,
      }),
    },
    // imagen -> video: misma model id, solo suma first_frame_url
    editar: {
      model: "bytedance/seedance-2",
      campoImagenes: "first_frame_url",
      armarInput: (prompt, _tamano, urls, _formato, _calidad, video) => ({
        prompt,
        first_frame_url: urls[0],
        duration: video?.duracion || 5,
        aspect_ratio: video?.aspecto || "16:9",
        resolution: video?.resolucion || "720p",
        generate_audio: video?.sonido !== false,
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

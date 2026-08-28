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
 * "Realista", "Edición", "Económicos" o "Retoque". `nota` es la línea que se muestra
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
    id: "kie-flux2-flex",
    proveedor: "kie",
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
    id: "kie-grok-segmentmap",
    proveedor: "kie",
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
    nombre: "Z-Image",
    grupo: "Económicos",
    nota: "el más barato para probar prompts",
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
    nombre: "Seedream 5 Lite",
    grupo: "Económicos",
    nota: "liviano y con calidad ajustable, buena opción intermedia de precio",
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
    nombre: "Recraft Quitar Fondo",
    grupo: "Retoque",
    nota: "saca el fondo de una foto en un clic — el más barato de todos, 1 crédito",
    creditos: 1, // el único confirmado por la doc: "1 credit" por tarea
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
    nombre: "Topaz Upscale",
    grupo: "Retoque",
    nota: "duplica la resolución de una imagen sin perder nitidez",
    creditos: 2, // estimado, no publicado
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
];

export function buscarModeloKie(id) {
  return MODELOS_KIE.find((m) => m.id === id) || null;
}

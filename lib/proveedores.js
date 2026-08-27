/**
 * Registro declarativo de modelos de Kie AI. Agregar un modelo nuevo es agregar una
 * entrada acá — nunca hace falta tocar las rutas de generar/editar/tarea.
 *
 * Cada entrada tiene un sub-objeto `generar` y/o `editar` con:
 *  - `model`: el id exacto que espera Kie en POST /jobs/createTask.
 *  - `campoImagenes`: el nombre del campo de `input` que lleva las URLs de referencia
 *    (o null si ese modo no usa referencias).
 *  - `armarInput(prompt, tamano, urls, formato)`: arma el objeto `input` mapeando
 *    nuestros controles (tamano "1024x1024", formato "jpeg") a los valores que Kie
 *    espera (aspect_ratio "1:1", output_format "jpg").
 *
 * `controles` declara qué controles del panel aplican a este modelo, para que
 * Controles.js sepa qué esconder. `creditos` es una estimación: Kie no publica un
 * número exacto por modelo (la doc solo dice "10-50 créditos típico" para imágenes),
 * así que conviene revisar el saldo real después de las primeras tareas y ajustar acá.
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

export const MODELOS_KIE = [
  {
    id: "kie-flux2-pro",
    proveedor: "kie",
    nombre: "Flux-2 Pro",
    creditos: 40,
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
    creditos: 40,
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
];

export function buscarModeloKie(id) {
  return MODELOS_KIE.find((m) => m.id === id) || null;
}

export function esModeloKie(id) {
  return typeof id === "string" && id.startsWith("kie-");
}

/** Distintos de los ids internos ("kie-flux2-pro"): son los `model` crudos que Kie
 * devuelve y que quedan guardados en la columna `modelo` de la tabla. Sirven para que
 * el medidor de gasto en dólares no intente tarifar filas de Kie con la tabla PRECIOS
 * de OpenAI. */
const MODELOS_KIE_CRUDOS = new Set(
  MODELOS_KIE.flatMap((m) => [m.generar?.model, m.editar?.model]).filter(Boolean)
);

export function esModeloKieCrudo(modelo) {
  return MODELOS_KIE_CRUDOS.has(modelo);
}

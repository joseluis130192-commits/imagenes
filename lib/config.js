/**
 * Precios estimados por imagen de salida, en dólares, base 1024x1024.
 * Alimentan el medidor de gasto: son de referencia, no la factura.
 * Si OpenAI cambia la tabla, se edita acá y listo.
 */
export const PRECIOS = {
  "gpt-image-1-mini": { low: 0.005, medium: 0.011, high: 0.036 },
  "gpt-image-1.5": { low: 0.009, medium: 0.04, high: 0.2 },
  "gpt-image-2": { low: 0.006, medium: 0.05, high: 0.211 },
  "gpt-image-1": { low: 0.011, medium: 0.042, high: 0.167 },
};

export const MODELOS_BASE = ["gpt-image-1-mini", "gpt-image-1.5", "gpt-image-2", "gpt-image-1"];

/** Las medidas no cuadradas usan más tokens de salida. */
export const FACTOR_NO_CUADRADO = 1.5;

export const TAMANOS = [
  { valor: "1024x1024", nombre: "Cuadrada", corto: "1:1", proporcion: "1 / 1" },
  { valor: "1024x1536", nombre: "Vertical", corto: "2:3", proporcion: "2 / 3" },
  { valor: "1536x1024", nombre: "Horizontal", corto: "3:2", proporcion: "3 / 2" },
  { valor: "auto", nombre: "Automático", corto: "Auto", proporcion: "1 / 1" },
];

export const CALIDADES = [
  { valor: "low", nombre: "Baja" },
  { valor: "medium", nombre: "Media" },
  { valor: "high", nombre: "Alta" },
  { valor: "auto", nombre: "Auto" },
];

export const FORMATOS = [
  { valor: "png", nombre: "PNG" },
  { valor: "jpeg", nombre: "JPG" },
  { valor: "webp", nombre: "WEBP" },
];

export const FONDOS = [
  { valor: "auto", nombre: "Auto" },
  { valor: "opaque", nombre: "Opaco" },
  { valor: "transparent", nombre: "Transp." },
];

/** Estilos que se suman al final del prompt. Editables sin tocar nada más. */
export const ESTILOS = [
  { nombre: "Foto editorial", texto: "fotografía editorial realista, luz natural, profundidad de campo suave, sin texto" },
  { nombre: "Ilustración", texto: "ilustración editorial plana, formas geométricas, paleta limitada de tres colores, sin texto" },
  { nombre: "Fondo para placa", texto: "fondo abstracto con textura sutil, composición despejada en el centro para superponer texto, sin texto" },
  { nombre: "Documental", texto: "estilo documental, grano fino, colores desaturados, encuadre honesto, sin texto" },
  { nombre: "Retrato", texto: "retrato de medio cuerpo, fondo neutro, iluminación lateral suave, sin texto" },
  { nombre: "Diagrama", texto: "diagrama explicativo limpio, líneas nítidas, fondo claro, sin texto" },
];

export function precioUnitario(modelo, calidad, tamano) {
  const tabla = PRECIOS[modelo] || PRECIOS["gpt-image-1-mini"];
  const nivel = calidad === "auto" ? "medium" : calidad;
  const base = tabla[nivel] ?? tabla.medium;
  return tamano === "1024x1024" || tamano === "auto" ? base : base * FACTOR_NO_CUADRADO;
}

export function dolares(n) {
  return "US$ " + n.toFixed(n < 1 ? 3 : 2).replace(".", ",");
}

export function proporcionDe(tamano) {
  return TAMANOS.find((t) => t.valor === tamano)?.proporcion || "1 / 1";
}

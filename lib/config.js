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

export function proporcionDe(tamano) {
  return TAMANOS.find((t) => t.valor === tamano)?.proporcion || "1 / 1";
}

/** Duraciones, resoluciones y aspectos de video posibles entre todos los modelos; cada
 *  modelo filtra con `duracionesPermitidas`/`resolucionesPermitidas`/`aspectosPermitidos`. */
export const DURACIONES_VIDEO = [4, 5, 10, 15].map((n) => ({ valor: n, nombre: `${n}s` }));

export const RESOLUCIONES_VIDEO = [
  { valor: "480p", nombre: "480p" },
  { valor: "720p", nombre: "720p" },
  { valor: "1080p", nombre: "1080p" },
];

export const ASPECTOS_VIDEO = [
  { valor: "1:1", nombre: "1:1" },
  { valor: "16:9", nombre: "16:9" },
  { valor: "9:16", nombre: "9:16" },
  { valor: "4:3", nombre: "4:3" },
  { valor: "3:4", nombre: "3:4" },
];

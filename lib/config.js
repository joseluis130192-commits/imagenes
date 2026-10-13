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

/** Voces de ElevenLabs que acepta Kie (copiadas de la doc del modelo multilingual v2).
 *  La muestra de cada una está en MUESTRA_VOZ(id). */
export const VOCES = [
  ["EkK5I93UQWFDigLMpZcX", "James · ronca, enganchadora"],
  ["Z3R5wn05IrDiVCyEkUrK", "Arabella · misteriosa, emotiva"],
  ["NNl6r8mD7vthiJatiJt1", "Bradford · expresiva, articulada"],
  ["YOq2y2Up4RgXP2HyXjE5", "Xavier · locutor metálico"],
  ["B8gJV1IhpuegLxdpXFOE", "Kuon · alegre, clara"],
  ["2zRM7PkgwBPiau2jvVXc", "Monika Sogam · grave, natural"],
  ["1SM7GgM6IMuvQlz2BwM3", "Mark · casual, relajada"],
  ["5l5f8iK3YPeGga21rQIX", "Adeline · femenina, conversacional"],
  ["scOwDtmlUjD3prqpp97I", "Sam · atención al cliente"],
  ["NOpBlnGInO9m6vDvFkFC", "Spuds Oxley · sabia, cercana"],
  ["BZgkqPqms7Kj9ulSkVzn", "Eve · auténtica, enérgica"],
  ["wo6udizrrtpIxWGp2qJk", "Northern Terry"],
  ["gU0LNdkMOQCOrPrwtbee", "Relator de fútbol británico"],
  ["DGzg6RaUqxGRTHSBjfgF", "Brock · sargento, fuerte"],
  ["x70vRnQBMBu4FAYhjJbO", "Nathan · conductor de radio"],
  ["Sm1seazb4gs7RSlUVw7c", "Anika · animada, amigable"],
  ["P1bg08DkjqiVEzOn76yG", "Viraj · rica, suave"],
  ["qDuRKMlYmrm8trt5QyBn", "Taksh · calma, seria"],
  ["qXpMhyvQqiRxWQs4qSSB", "Horatius · personaje enérgico"],
  ["TX3LPaxmHKxFdv7VOQHJ", "Liam · creador de redes"],
  ["N2lVS1w4EtoT3dr4eOWO", "Callum · ronca, pícara"],
  ["FGY2WhTYpPnrIDTdsKH5", "Laura · entusiasta"],
  ["kPzsL2i3teMYv0FxEYQ6", "Brittney · redes, juvenil"],
  ["UgBBYS2sOqTuMpoF3BR0", "Mark · conversación natural"],
  ["hpp4J3VqNfWAUOO0d1Us", "Bella · profesional, cálida"],
  ["nPczCjzI2devNBz1zQrb", "Brian · grave, reconfortante"],
  ["uYXf8XasLslADfZ2MB4u", "Hope · burbujeante"],
  ["gs0tAILXbY5DNrJrsM6F", "Jeff · con clase, fuerte"],
  ["DTKMou8ccj1ZaWGBiotd", "Jamahal · joven, vibrante"],
  ["vBKc2FfBKJfcZNyEt1n6", "Finn · juvenil, entusiasta"],
  ["DYkrAHD8iwork3YSUBbs", "Tom · charlas y libros"],
  ["56AoDkrOh6qfVPDXZ7Pt", "Cassidy · nítida, directa"],
  ["eR40ATw9ArzDf9h3v7t7", "Addison 2.0 · australiana, podcast"],
  ["g6xIsTj2HwM6VR4iXFCw", "Jessica Anne Bogart · charlatana"],
  ["lcMyyd2HUfFzxdCaC4Ta", "Lucy · fresca, casual"],
  ["6aDn1KB0hjpdcocrUkmq", "Tiffany · natural, acogedora"],
  ["Sq93GQT4X1lKDXsQcixO", "Felix · cálida, positiva"],
  ["flHkNRp1BlvT73UL6gyz", "Jessica Anne Bogart · villana"],
  ["9yzdeviXkFddZ4Oz8Mok", "Lutz · risueña"],
  ["pPdl9cQBQq4p6mRkZy2Z", "Emma · adorable"],
  ["zYcjlYFOd3taleS0gkk3", "Edward · fuerte, canchera"],
  ["nzeAacJi50IvxcyDnMXa", "Marshal · profesor divertido"],
  ["ruirxsoakN0GWmGNIo04", "John Morgan · cowboy rudo"],
  ["TC0Zp7WVFzhA8zpTlRqV", "Aria · villana sensual"],
  ["ljo9gAlSqKOvF6D8sOsX", "Viking Bjorn · épico"],
  ["PPzYpIqttlTYA83688JI", "Pirate Marshal"],
  ["8JVbfL6oEdmuxKn5DK2C", "Johnny Kid · narrador serio"],
  ["iCrDUkL56s3C8sCRl7wb", "Hope · poética, romántica"],
  ["wJqPPQ618aTW29mptyoc", "Ana Rita · suave, expresiva"],
  ["EiNlNiXeDU1pqqOPrYMO", "John Doe · grave"],
  ["4YYIPFl9wE5c4L2eu2Gb", "Burt Reynolds · grave, suave"],
  ["6F5Zhi321D3Oq7v1oNT4", "Hank · narrador grave"],
  ["YXpFCvM1S3JbWEJhoskW", "Wyatt · cowboy sabio"],
  ["LG95yZDEHg6fCZdQjLqj", "Phil · locutor explosivo"],
  ["CeNX9CMwmxDxUF5Q2Inm", "Johnny Dynamite · DJ vintage"],
  ["aD6riP1btT197c6dACmy", "Rachel M · radio británica"],
  ["mtrellq69YZsNwzUSyXh", "Rex Thunder · grave, dura"],
  ["dHd5gvgSOzSfduK4CvEg", "Ed · locutor nocturno"],
  ["eVItLK1UvXctxuaRV2Oq", "Jean · femme fatale"],
  ["esy0r39YPLQjOczyOib8", "Britney · villana calculadora"],
  ["Tsns2HvNFKfGiNjllgqo", "Sven · emotiva"],
  ["1U02n4nD6AdIZ9CjF053", "Viraj · suave, gentil"],
  ["AeRdCCKzvd23BpJoofzx", "Nathaniel · británica, calma"],
  ["LruHrtVF6PSyGItzMNHS", "Benjamin · grave, cálida"],
  ["1wGbFxmAM3Fgw63G1zZJ", "Allison · calma, meditativa"],
  ["hqfrgApggtO1785R4Fsn", "Theodore HQ · serena"],
  ["MJ0RnG71ty4LH3dvNfSd", "Leon · tranquilizadora"],
].map(([id, nombre]) => ({ id, nombre }));

export const MUESTRA_VOZ = (id) => `https://static.aiquickdraw.com/elevenlabs/voice/${id}.mp3`;

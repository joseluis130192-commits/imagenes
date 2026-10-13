const API_BASE = "https://api.kie.ai/api/v1";
// El endpoint de subida de archivos vive en un host aparte del resto de la API de Kie.
const SUBIDA_BASE = "https://kieai.redpandaai.co/api";

export function key() {
  return process.env.KIE_API_KEY || "";
}

function mensajeEstado(estado, cuerpo) {
  const msg = cuerpo?.msg || "";
  switch (estado) {
    case 401:
      return "La API key de Kie no es válida. Revisá KIE_API_KEY.";
    case 402:
      return "No hay créditos suficientes en la cuenta de Kie para esta tarea.";
    case 422:
      return `Kie rechazó los parámetros de la tarea${msg ? ": " + msg : "."}`;
    case 429:
      return "Se alcanzó el límite de pedidos por minuto en Kie. Esperá un momento y probá de nuevo.";
    case 501:
      return `La generación falló del lado de Kie${msg ? ": " + msg : "."}`;
    default:
      return msg || `Kie respondió con un error (código ${estado}).`;
  }
}

/** Crea una tarea en el market de Kie y devuelve su taskId. Nunca lanza. */
export async function crearTarea(modelo, input) {
  if (!key()) {
    return {
      ok: false,
      estado: 500,
      mensaje: "Falta la API key de Kie. Copiá .env.ejemplo a .env.local, pegá tu key en KIE_API_KEY y reiniciá el servidor.",
    };
  }

  console.log("kie crearTarea: pidiendo", modelo, JSON.stringify(input));

  let respuesta, crudo;
  try {
    respuesta = await fetch(`${API_BASE}/jobs/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelo, input }),
    });
    crudo = await respuesta.text();
  } catch (e) {
    return { ok: false, estado: 502, mensaje: `No se pudo contactar a Kie: ${e.message}` };
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return { ok: false, estado: 502, mensaje: `Kie respondió algo que no es JSON (código ${respuesta.status}).` };
  }

  console.log("kie crearTarea: respuesta", respuesta.status, crudo);

  if (!respuesta.ok) {
    return { ok: false, estado: respuesta.status, mensaje: mensajeEstado(respuesta.status, cuerpo) };
  }

  const taskId = cuerpo?.data?.taskId;
  if (!taskId) {
    return { ok: false, estado: 502, mensaje: "Kie no devolvió un taskId en la respuesta." };
  }

  console.log("kie crearTarea: taskId obtenido", taskId);

  return { ok: true, taskId };
}

/**
 * Consulta el estado de una tarea. Devuelve el estado crudo de Kie ("waiting",
 * "queuing", "generating", "success", "fail"), las URLs de resultado (si terminó) y
 * el `param` original (para reconstruir el prompt/los ajustes sin haberlos guardado
 * en ningún lado mientras la tarea corría).
 */
export async function verTarea(taskId) {
  if (!key()) {
    return { ok: false, estado: 500, mensaje: "Falta la API key de Kie." };
  }

  let respuesta, crudo;
  try {
    respuesta = await fetch(`${API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key()}` },
    });
    crudo = await respuesta.text();
  } catch (e) {
    return { ok: false, estado: 502, mensaje: `No se pudo consultar la tarea en Kie: ${e.message}` };
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return { ok: false, estado: 502, mensaje: `Kie respondió algo que no es JSON (código ${respuesta.status}).` };
  }

  if (!respuesta.ok) {
    return { ok: false, estado: respuesta.status, mensaje: mensajeEstado(respuesta.status, cuerpo) };
  }

  const d = cuerpo.data || {};
  // Para poder ver en el log de Vercel en qué estado va cada consulta.
  console.log("kie tarea", taskId, d.state);

  // resultJson es un STRING con JSON adentro (no un objeto). Si no parsea, es un
  // problema real de la respuesta, no "todavía no está" — lo marcamos aparte para que
  // la ruta lo trate como error explícito y no como una tarea en curso.
  let resultUrls = [];
  let errorParseo = null;
  if (d.resultJson) {
    try {
      resultUrls = JSON.parse(d.resultJson).resultUrls || [];
    } catch (err) {
      errorParseo = err.message;
    }
  }

  // `param` es un string con JSON adentro, y ADENTRO de eso, `param.input` viene otra
  // vez como string con JSON (doble serializado) en vez de objeto anidado. Verificado
  // con curl directo a Kie: {"input":"{\"prompt\":\"...\",\"aspect_ratio\":\"1:1\"}","model":"..."}
  let param = {};
  if (d.param) {
    try {
      param = JSON.parse(d.param);
      if (typeof param.input === "string") {
        param.input = JSON.parse(param.input);
      }
    } catch {}
  }

  return {
    ok: true,
    // "waiting" | "queuing" | "generating" | "success" | "fail" (o cualquier otro
    // valor que Kie sume después: nunca lo tratamos como error, solo "success"/"fail" lo son).
    estado: d.state,
    resultUrls,
    errorParseo,
    param,
    modelo: d.model,
    failCode: d.failCode || "",
    failMsg: d.failMsg || "",
    creditosConsumidos: d.creditsConsumed ?? null,
  };
}

/** Saldo de créditos de la cuenta. Nunca lanza. */
export async function creditos() {
  if (!key()) return { ok: false, mensaje: "Falta la API key de Kie." };

  try {
    const respuesta = await fetch(`${API_BASE}/chat/credit`, { headers: { Authorization: `Bearer ${key()}` } });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok || typeof cuerpo?.data !== "number") {
      return { ok: false, mensaje: mensajeEstado(respuesta.status, cuerpo) };
    }
    return { ok: true, saldo: cuerpo.data };
  } catch (e) {
    return { ok: false, mensaje: `No se pudo consultar el saldo de Kie: ${e.message}` };
  }
}

/**
 * Sube un archivo (imagen de referencia, imagen base o audio) a Kie y devuelve la URL
 * pública que hace falta pasarle a createTask: Kie no acepta binarios en el pedido,
 * solo URLs. La URL sale de `data.downloadUrl` (docs.kie.ai/file-upload-api/quickstart);
 * los otros campos quedan por si la respuesta cambia de forma. Kie borra el archivo a
 * las 24 horas, que sobra para una tarea.
 */
export async function subirArchivo(archivo) {
  if (!key()) return { ok: false, mensaje: "Falta la API key de Kie." };

  let respuesta, crudo;
  try {
    // El File que llega de req.formData() no siempre es de la misma implementación que
    // usa el fetch de Node (undici): se rearma como un Blob propio a partir de los bytes.
    // Sin Content-Type a mano: fetch lo arma solo, con el boundary del multipart.
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const mime = archivo.type || "application/octet-stream";
    const nombre = archivo.name || "referencia.png";

    const forma = new FormData();
    forma.append("file", new Blob([buffer], { type: mime }), nombre);
    forma.append("uploadPath", "taller-imagenes");

    console.log("kie subirArchivo: subiendo", nombre, buffer.length, "bytes", mime);

    respuesta = await fetch(`${SUBIDA_BASE}/file-stream-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}` },
      body: forma,
    });
    crudo = await respuesta.text();
  } catch (e) {
    // El "fetch failed" de undici esconde el motivo real en `cause`.
    const c = e.cause || {};
    const detalle = [c.code && `code=${c.code}`, c.errno !== undefined && `errno=${c.errno}`, c.message && `causa=${c.message}`]
      .filter(Boolean)
      .join(" · ");
    console.error("kie subirArchivo: falló el envío", e.message, detalle);
    return { ok: false, mensaje: `No se pudo subir el archivo a Kie: ${e.message}${detalle ? ` (${detalle})` : ""}` };
  }

  console.log("kie subirArchivo: respuesta", respuesta.status, crudo);

  let cuerpo;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return { ok: false, mensaje: `Kie respondió algo que no es JSON al subir el archivo (código ${respuesta.status}).` };
  }

  const url = cuerpo?.data?.downloadUrl || cuerpo?.data?.fileUrl || cuerpo?.data?.url || cuerpo?.fileUrl || cuerpo?.url;
  if (!respuesta.ok || !url) {
    return { ok: false, mensaje: mensajeEstado(respuesta.status, cuerpo) };
  }

  console.log("kie subirArchivo: url obtenida", url);

  return { ok: true, url };
}

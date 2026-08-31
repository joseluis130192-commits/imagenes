import path from "path";
import { supabase } from "@/lib/supabase";
import { claveObjeto } from "@/lib/almacen";

export const dynamic = "force-dynamic";
// Los videos pesan mucho más que una imagen: bajarlos de Supabase puede tardar más
// que el default de la ruta.
export const maxDuration = 300;

const TIPOS = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/**
 * Parsea un header Range de a un solo rango ("bytes=100-200", "bytes=100-"). El
 * reproductor <video> lo necesita para poder adelantar sin bajar el archivo entero.
 */
function rangoPedido(header, tamanoTotal) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!match) return null;
  const [, inicioStr, finStr] = match;
  const inicio = inicioStr ? Number(inicioStr) : 0;
  const fin = finStr ? Number(finStr) : tamanoTotal - 1;
  if (Number.isNaN(inicio) || Number.isNaN(fin) || inicio > fin || fin >= tamanoTotal) return null;
  return { inicio, fin };
}

export async function GET(req, { params }) {
  // basename corta cualquier intento de salir de la carpeta
  const nombre = path.basename(params.archivo || "");
  const tipo = TIPOS[path.extname(nombre).toLowerCase()];
  if (!tipo) return new Response("Formato no permitido", { status: 400 });

  let clave;
  try {
    clave = claveObjeto(nombre);
  } catch {
    return new Response("No encontrada", { status: 404 });
  }

  const { data, error } = await supabase.storage.from("imagenes").download(clave);
  if (error || !data) return new Response("No encontrada", { status: 404 });

  const buffer = Buffer.from(await data.arrayBuffer());
  const rango = rangoPedido(req.headers.get("range"), buffer.length);

  if (rango) {
    const { inicio, fin } = rango;
    return new Response(buffer.subarray(inicio, fin + 1), {
      status: 206,
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `inline; filename="${nombre}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${inicio}-${fin}/${buffer.length}`,
        "Content-Length": String(fin - inicio + 1),
      },
    });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "Content-Length": String(buffer.length),
    },
  });
}

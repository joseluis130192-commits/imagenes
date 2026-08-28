import path from "path";
import { supabase } from "@/lib/supabase";
import { claveObjeto } from "@/lib/almacen";

export const dynamic = "force-dynamic";

const TIPOS = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_req, { params }) {
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

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

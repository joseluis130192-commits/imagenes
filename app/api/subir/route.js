import { subirArchivo } from "@/lib/kie";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sube a Kie una imagen o un audio chico que viene de la compu y devuelve su URL. Los
 * archivos de más de ~4MB no pueden pasar por acá en Vercel: el navegador los sube
 * directo al bucket con /api/subir/firmar.
 */
export async function POST(req) {
  let entrada;
  try {
    entrada = await req.formData();
  } catch {
    return Response.json({ error: "No se pudo leer el archivo enviado." }, { status: 400 });
  }

  const archivo = entrada.get("archivo");
  if (!archivo || typeof archivo.arrayBuffer !== "function") {
    return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }

  const r = await subirArchivo(archivo);
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: 502 });
  return Response.json({ url: r.url });
}

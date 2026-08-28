import { leerHistorial } from "@/lib/almacen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const historial = await leerHistorial();
  return Response.json({ historial }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

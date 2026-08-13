import { leerHistorial } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ historial: await leerHistorial() });
}

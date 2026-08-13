import crypto from "crypto";

const TREINTA_DIAS = 60 * 60 * 24 * 30;

export async function POST(req) {
  const { clave } = await req.json().catch(() => ({}));

  if (!clave || clave !== process.env.CLAVE_ACCESO) {
    return Response.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const sesion = crypto.createHmac("sha256", process.env.CLAVE_ACCESO).update("ok").digest("hex");

  const respuesta = Response.json({ ok: true });
  respuesta.headers.append(
    "Set-Cookie",
    [
      `sesion=${sesion}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${TREINTA_DIAS}`,
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
  return respuesta;
}

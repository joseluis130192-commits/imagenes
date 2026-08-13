import { NextResponse } from "next/server";

const PUBLICAS = ["/entrar", "/api/entrar"];

async function firma(clave) {
  const codificador = new TextEncoder();
  const llave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(clave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign("HMAC", llave, codificador.encode("ok"));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // la puerta y su formulario quedan siempre accesibles
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const clave = process.env.CLAVE_ACCESO;
  if (!clave) {
    // sin clave configurada no dejamos pasar, pero avisamos en vez de romper
    return new NextResponse("Falta la variable CLAVE_ACCESO en el entorno de Vercel.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const cookie = req.cookies.get("sesion")?.value;
    if (cookie && cookie === (await firma(clave))) return NextResponse.next();
  } catch {
    // cualquier problema al verificar se trata como sesión inválida
  }

  const destino = req.nextUrl.clone();
  destino.pathname = "/entrar";
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
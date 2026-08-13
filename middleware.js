import { NextResponse } from "next/server";

async function hmacHex(mensaje, clave) {
  const codificador = new TextEncoder();
  const llave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(clave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", llave, codificador.encode(mensaje));
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname === "/entrar" || pathname === "/api/entrar" || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("sesion")?.value || "";
  const esperada = await hmacHex("ok", process.env.CLAVE_ACCESO || "");

  if (cookie === esperada) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

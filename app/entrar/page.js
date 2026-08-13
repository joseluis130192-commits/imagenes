"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Entrar() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Contraseña incorrecta.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo hablar con el servidor.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm border-[3px] border-tinta bg-hoja p-6 shadow-duro">
        <h1 className="font-display text-[26px] font-black leading-[0.95] tracking-[-0.03em]">
          Taller de <span className="marcador">imágenes</span>
        </h1>
        <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-grafito">
          Acceso protegido
        </p>

        <form onSubmit={entrar} className="mt-5 space-y-4">
          <div>
            <label className="etiqueta" htmlFor="clave">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              autoFocus
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="campo"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="border-[2.5px] border-tinta bg-rojo px-3.5 py-2.5 text-[13px] font-semibold text-hoja shadow-duroSm">
              {error}
            </div>
          )}

          <button type="submit" className="boton-fuerte" disabled={enviando || !clave}>
            {enviando ? "Entrando…" : "Entrar →"}
          </button>
        </form>
      </div>
    </div>
  );
}

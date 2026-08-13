"use client";

import { dolares } from "@/lib/config";

export default function BarraAccion({ modo, generando, costo, onGenerar }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t-[3px] border-tinta bg-papel px-4 py-3 lg:hidden">
      <div>
        <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-grafito">Tanda</span>
        <b className="marcador block font-display text-[16px] font-black leading-none text-tinta">{dolares(costo)}</b>
      </div>
      <button className="boton-fuerte flex-1" onClick={onGenerar} disabled={generando}>
        {generando ? "Generando…" : modo === "editar" ? "Aplicar cambios →" : "Generar →"}
      </button>
    </div>
  );
}

"use client";

export default function BarraAccion({ modo, generando, costo, caro, onGenerar }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t-[3px] border-tinta bg-papel px-4 py-3 lg:hidden">
      <div>
        <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-grafito">Tanda</span>
        {/* Más de 100 créditos o sin precio confirmado: resaltado igual que en el panel. */}
        <b
          className={`block font-display text-[16px] font-black leading-none ${
            caro ? "border-2 border-tinta bg-rojo px-1 text-hoja" : "marcador text-tinta"
          }`}
        >
          {costo}
        </b>
      </div>
      <button className="boton-fuerte flex-1" onClick={onGenerar} disabled={generando}>
        {generando ? "Generando…" : modo === "editar" ? "Aplicar cambios →" : modo === "hablar" ? "Hacer hablar →" : modo === "secuencia" ? "Generar clips →" : "Generar →"}
      </button>
    </div>
  );
}

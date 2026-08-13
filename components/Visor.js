"use client";

import { useEffect } from "react";

export default function Visor({ imagen, onCerrar, onAnterior, onSiguiente }) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") onAnterior();
      if (e.key === "ArrowRight") onSiguiente();
    };
    window.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [onCerrar, onAnterior, onSiguiente]);

  if (!imagen) return null;

  const fecha = new Date(imagen.fecha).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-papel" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-4 border-b-[3px] border-tinta bg-amarillo px-5 py-2.5">
        <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.08em]">{imagen.archivo}</p>
        <div className="flex items-center gap-2">
          <button onClick={onAnterior} className="boton px-3 py-1.5" aria-label="Anterior">←</button>
          <button onClick={onSiguiente} className="boton px-3 py-1.5" aria-label="Siguiente">→</button>
          <a href={imagen.url} download={imagen.archivo} className="boton bg-lima px-3 py-1.5">Descargar</a>
          <button onClick={onCerrar} className="boton px-3 py-1.5" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6" onClick={onCerrar}>
          <img
            src={imagen.url}
            alt={imagen.prompt || ""}
            className="max-h-full max-w-full border-[3px] border-tinta object-contain shadow-duroLg"
          />
        </div>

        <aside className="w-full shrink-0 space-y-4 border-t-[3px] border-tinta bg-hoja p-5 lg:w-80 lg:overflow-y-auto lg:border-l-[3px] lg:border-t-0">
          <div>
            <span className="etiqueta">Prompt</span>
            <p className="text-[14px] font-medium leading-relaxed">{imagen.prompt}</p>
          </div>

          {imagen.promptRevisado && (
            <div>
              <span className="etiqueta">Reescrito por el modelo</span>
              <p className="text-[13px] leading-relaxed text-grafito">{imagen.promptRevisado}</p>
            </div>
          )}

          <dl className="space-y-2 border-t-2 border-dashed border-tinta/30 pt-4 font-mono text-[11.5px]">
            {[
              ["Modelo", imagen.modelo],
              ["Calidad", imagen.calidad],
              ["Tamaño", imagen.tamano],
              ["Origen", imagen.origen === "editada" ? "edición" : "generación"],
              ["Fecha", fecha],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="font-bold uppercase text-grafito">{k}</dt>
                <dd className="text-right font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

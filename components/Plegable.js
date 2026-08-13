"use client";

import { useEffect, useState } from "react";

export default function Plegable({ titulo, resumen, children }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setAbierto(true);
  }, []);

  return (
    <div className="border-[2.5px] border-tinta bg-hoja">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em]">{titulo}</span>
          {!abierto && resumen && (
            <span className="mt-1 block truncate font-mono text-[10px] font-medium text-grafito">{resumen}</span>
          )}
        </div>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center border-2 border-tinta text-[11px] font-bold
            transition-transform duration-200 ${abierto ? "rotate-180 bg-lima" : "bg-hoja"}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t-2 border-dashed border-tinta/30 px-3.5 py-4">{children}</div>
      )}
    </div>
  );
}

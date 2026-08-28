"use client";

export default function Medidor({ imagenesHoy, creditosGastados, presupuesto, onPresupuesto, saldoKie }) {
  const proporcion = presupuesto > 0 ? Math.min(creditosGastados / presupuesto, 1) : 0;
  const pasado = presupuesto > 0 && creditosGastados >= presupuesto;
  const cerca = proporcion >= 0.8 && !pasado;

  return (
    <div className="flex w-full items-stretch gap-2.5 sm:w-auto sm:flex-wrap sm:gap-3">
      <div className="ficha shrink-0 rotate-[-1deg] px-3 py-2 sm:px-4 sm:py-2.5">
        <b className="block font-display text-[21px] font-black leading-none tabular-nums sm:text-[24px]">{imagenesHoy}</b>
        <i className="mt-1.5 block font-mono text-[9.5px] font-bold not-italic uppercase tracking-[0.1em] text-grafito">
          imágenes hoy
        </i>
      </div>

      <div className={`ficha flex-1 px-3 py-2 rotate-[0.6deg] sm:flex-none sm:min-w-[214px] sm:px-4 sm:py-2.5 ${pasado ? "bg-rojo/10" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <b className="font-display text-[21px] font-black leading-none tabular-nums sm:text-[24px]">
            <span className={pasado ? "text-rojo" : ""}>{creditosGastados}</span>
          </b>
          <label className="flex items-center gap-1 font-mono text-[12px] font-bold text-grafito">
            <span aria-hidden>de</span>
            <span className="sr-only">Presupuesto diario en créditos</span>
            <input
              type="number"
              min="0"
              step="1"
              value={presupuesto}
              onChange={(e) => onPresupuesto(Number(e.target.value))}
              className="w-12 border-b-2 border-dashed border-tinta/40 bg-transparent text-right tabular-nums
                         hover:border-tinta focus:border-tinta focus:outline-none"
            />
          </label>
        </div>

        {/* el medidor: se llena como un resaltador sobre el renglón */}
        <div className="mt-2 h-[9px] w-full border-2 border-tinta bg-hoja">
          <div
            className={`h-full transition-[width] duration-500 ${pasado ? "bg-rojo" : cerca ? "bg-amarillo" : "bg-lima"}`}
            style={{ width: `${proporcion * 100}%` }}
          />
        </div>

        <i className="mt-1.5 block font-mono text-[9.5px] font-bold not-italic uppercase tracking-[0.1em] text-grafito">
          créditos gastados (sesión){saldoKie != null ? ` · saldo Kie ${saldoKie}` : ""}
        </i>
      </div>
    </div>
  );
}

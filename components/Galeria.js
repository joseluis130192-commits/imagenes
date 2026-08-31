"use client";

import { useMemo, useState } from "react";
import { proporcionDe } from "@/lib/config";

const FILTROS_TIPO = [
  { valor: "todos", nombre: "Todos" },
  { valor: "imagen", nombre: "Imágenes" },
  { valor: "video", nombre: "Videos" },
];

/** Inclinación estable por imagen: la misma foto siempre queda pegada igual. */
function inclinacion(id = "") {
  let suma = 0;
  for (let i = 0; i < id.length; i++) suma += id.charCodeAt(i);
  return ((suma % 5) - 2) * 0.5;
}

function Placa({ proporcion }) {
  return (
    <div className="border-[2.5px] border-dashed border-tinta bg-hoja p-1.5 shadow-duroSm sm:p-2">
      <div className="revelando animate-revelar grid place-items-center border-2 border-tinta/20" style={{ aspectRatio: proporcion }}>
        <span className="border-2 border-tinta bg-amarillo px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
          Revelando…
        </span>
      </div>
    </div>
  );
}

function Tarjeta({ imagen, onAbrir, onReusar, onBorrar }) {
  return (
    <figure
      className="group relative animate-entrar border-[2.5px] border-tinta bg-hoja p-1.5 pb-2 shadow-duroSm
                 transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 hover:shadow-duroLg
                 sm:p-2.5 sm:pb-3 sm:shadow-duro"
      style={{ transform: `rotate(${inclinacion(imagen.id)}deg)` }}
    >
      <span className="cinta" aria-hidden />

      <div className="relative">
        <button onClick={onAbrir} className="block w-full cursor-zoom-in border-2 border-tinta" aria-label="Ver en grande">
          {imagen.tipo === "video" ? (
            <video src={imagen.url} className="block w-full bg-papel" muted playsInline preload="metadata" />
          ) : (
            <img src={imagen.url} alt={imagen.prompt?.slice(0, 120) || ""} loading="lazy" className="block w-full bg-papel" />
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-1.5 p-2
                        opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <a
            href={imagen.url}
            download={imagen.archivo}
            className="pointer-events-auto border-2 border-tinta bg-lima px-2.5 py-1 font-mono text-[10px] font-bold uppercase"
          >
            Descargar
          </a>
          <button
            onClick={onReusar}
            className="pointer-events-auto border-2 border-tinta bg-hoja px-2.5 py-1 font-mono text-[10px] font-bold uppercase"
          >
            Reusar
          </button>
          <button
            onClick={onBorrar}
            className="pointer-events-auto border-2 border-tinta bg-hoja px-2.5 py-1 font-mono text-[10px] font-bold uppercase hover:bg-rojo hover:text-hoja"
          >
            Borrar
          </button>
        </div>
      </div>

      <figcaption className="mt-2.5 space-y-1.5">
        <p className="line-clamp-2 text-[11.5px] font-medium leading-snug sm:text-[13px]">{imagen.prompt}</p>
        <p className="font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.04em] text-grafito sm:text-[10px]">
          {imagen.modelo} · {imagen.calidad} · {imagen.tamano}
          {imagen.origen === "editada" && <span className="marcador ml-1 text-tinta">editada</span>}
          {imagen.tipo === "video" && <span className="marcador ml-1 text-tinta">video</span>}
        </p>
      </figcaption>
    </figure>
  );
}

export default function Galeria({ imagenes, pendientes, tamano, onAbrir, onReusar, onBorrar }) {
  const [filtro, setFiltro] = useState("todos");
  const filtradas = useMemo(
    () => (filtro === "todos" ? imagenes : imagenes.filter((i) => (i.tipo || "imagen") === filtro)),
    [imagenes, filtro]
  );
  const vacia = !filtradas.length && !pendientes;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="border-[2.5px] border-tinta bg-lima px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-duroSm">
          Resultados {filtradas.length > 0 && `· ${filtradas.length}`}
        </span>
        <div className="flex gap-1.5">
          {FILTROS_TIPO.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`border-2 border-tinta px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em]
                ${filtro === f.valor ? "bg-lima" : "bg-hoja text-grafito hover:text-tinta"}`}
            >
              {f.nombre}
            </button>
          ))}
        </div>
        <span className="h-[2px] flex-1 bg-tinta/15" />
      </div>

      {vacia ? (
        <div className="col-span-full border-[2.5px] border-dashed border-tinta bg-hoja/70 px-4 py-10 text-center sm:px-6 sm:py-16">
          <p className="font-display text-[22px] font-black tracking-[-0.02em]">Todavía no revelaste nada</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] font-medium text-grafito">
            Escribí un prompt a la izquierda y generá la primera imagen.
          </p>
          <p className="mt-3 font-mano text-[24px] text-rojo">¡dale que es barato! ↖</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
          {Array.from({ length: pendientes }).map((_, i) => (
            <Placa key={`placa-${i}`} proporcion={proporcionDe(tamano)} />
          ))}
          {filtradas.map((img) => (
            <Tarjeta
              key={img.id}
              imagen={img}
              onAbrir={() => onAbrir(img)}
              onReusar={() => onReusar(img)}
              onBorrar={() => onBorrar(img)}
            />
          ))}
        </div>
      )}
    </>
  );
}

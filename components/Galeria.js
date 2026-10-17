"use client";

import { useMemo, useState } from "react";
import { proporcionDe } from "@/lib/config";
import { descargarClips } from "@/lib/secuencia";

const FILTROS_TIPO = [
  { valor: "todos", nombre: "Todos" },
  { valor: "imagen", nombre: "Imágenes" },
  { valor: "video", nombre: "Videos" },
  { valor: "audio", nombre: "Audios" },
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
          {imagen.tipo === "audio" ? (
            // Un audio no tiene miniatura: una placa con la nota, y el reproductor va abajo.
            <div className="grid aspect-[3/2] w-full place-items-center bg-amarillo/50">
              <span className="font-display text-[44px] font-black leading-none">♪</span>
            </div>
          ) : imagen.tipo === "video" ? (
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
            {imagen.tipo === "audio" ? "Usar en Hablar" : "Reusar"}
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
        {imagen.tipo === "audio" && <audio src={imagen.url} controls preload="none" className="h-9 w-full" />}
        <p className="line-clamp-2 text-[11.5px] font-medium leading-snug sm:text-[13px]">{imagen.prompt}</p>
        <p className="font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.04em] text-grafito sm:text-[10px]">
          {imagen.modelo} · {imagen.calidad} · {imagen.tamano}
          {imagen.origen === "editada" && <span className="marcador ml-1 text-tinta">editada</span>}
          {imagen.origen === "hablada" && <span className="marcador ml-1 text-tinta">lipsync</span>}
          {imagen.tipo === "video" && <span className="marcador ml-1 text-tinta">video</span>}
          {imagen.tipo === "audio" && <span className="marcador ml-1 text-tinta">audio</span>}
        </p>
      </figcaption>
    </figure>
  );
}

/**
 * Junta los clips de una misma secuencia en un solo bloque, en el lugar del clip más
 * reciente, y los ordena por número de clip. El resto de los ítems queda igual.
 */
function agrupar(items) {
  const grupos = new Map();
  const salida = [];
  for (const item of items) {
    if (!item.secuenciaId) {
      salida.push({ tipo: "item", item });
      continue;
    }
    if (!grupos.has(item.secuenciaId)) {
      const grupo = { tipo: "secuencia", id: item.secuenciaId, clips: [] };
      grupos.set(item.secuenciaId, grupo);
      salida.push(grupo);
    }
    grupos.get(item.secuenciaId).clips.push(item);
  }
  grupos.forEach((g) => g.clips.sort((a, b) => (a.secuenciaOrden ?? 0) - (b.secuenciaOrden ?? 0)));
  return salida;
}

function GrupoSecuencia({ grupo, onAbrir, onBorrar }) {
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState("");

  const bajarTodos = async () => {
    setBajando(true);
    setError("");
    try {
      await descargarClips(grupo.clips);
    } catch (err) {
      setError(err.message);
    } finally {
      setBajando(false);
    }
  };

  return (
    <section className="col-span-full animate-entrar border-[2.5px] border-tinta bg-hoja p-2.5 shadow-duro sm:p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="border-[2.5px] border-tinta bg-amarillo px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
          Secuencia · {grupo.clips.length} {grupo.clips.length === 1 ? "clip" : "clips"}
        </span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-grafito">{grupo.clips[0]?.prompt}</p>
        <button onClick={bajarTodos} disabled={bajando} className="boton bg-lima px-2.5 py-1 text-[11px]">
          {bajando ? "Bajando…" : "Descargar todos"}
        </button>
      </div>
      {error && <p className="mb-2 text-[12px] font-semibold text-rojo">{error}</p>}
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {grupo.clips.map((clip) => (
          <li key={clip.id} className="group relative">
            <span className="absolute left-1.5 top-1.5 z-10 border-2 border-tinta bg-amarillo px-1.5 font-mono text-[10px] font-bold">
              {String(clip.secuenciaOrden ?? "?").padStart(2, "0")}
            </span>
            <button onClick={() => onAbrir(clip)} className="block w-full cursor-zoom-in border-2 border-tinta" aria-label="Ver clip">
              <video src={clip.url} className="block w-full bg-papel" muted playsInline preload="metadata" />
            </button>
            <button
              onClick={() => onBorrar(clip)}
              className="absolute bottom-1.5 right-1.5 border-2 border-tinta bg-hoja px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase
                         opacity-0 transition-opacity hover:bg-rojo hover:text-hoja group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Borrar
            </button>
          </li>
        ))}
      </ol>
    </section>
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
          {agrupar(filtradas).map((g) =>
            g.tipo === "secuencia" ? (
              <GrupoSecuencia key={g.id} grupo={g} onAbrir={onAbrir} onBorrar={onBorrar} />
            ) : (
              <Tarjeta
                key={g.item.id}
                imagen={g.item}
                onAbrir={() => onAbrir(g.item)}
                onReusar={() => onReusar(g.item)}
                onBorrar={() => onBorrar(g.item)}
              />
            )
          )}
        </div>
      )}
    </>
  );
}

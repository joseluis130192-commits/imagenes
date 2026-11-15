"use client";

import { useEffect, useMemo, useRef } from "react";
import { buscarModeloKie, creditosReemplazo, formatoCreditos } from "@/lib/proveedores";
import { entradaDesdeArchivo, entradaDesdeFicha } from "@/lib/hablar";
import { Segmento } from "@/components/Controles";
import Transcurrido from "@/components/Transcurrido";

const ANIMATE = buscarModeloKie("kie-wan-animate");

function Paso({ numero, titulo, children }) {
  return (
    <div className="space-y-3 border-t-2 border-dashed border-tinta/30 pt-4 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-2 font-display text-[15px] font-black tracking-[-0.01em]">
        <span className="grid h-6 w-6 place-items-center border-[2.5px] border-tinta bg-amarillo font-mono text-[11px] shadow-duroSm">
          {numero}
        </span>
        {titulo}
      </p>
      {children}
    </div>
  );
}

function soltar(entrada) {
  if (entrada?.vista?.startsWith("blob:")) URL.revokeObjectURL(entrada.vista);
}

export default function Reemplazar({ reemplazo, setReemplazo, historial, onGenerar, generando, esperaDesde, costo, caro }) {
  const inputVideo = useRef(null);
  const inputImagen = useRef(null);
  const cambiar = (parcial) => setReemplazo((r) => ({ ...r, ...parcial }));
  const modo = ANIMATE.modos[reemplazo.modo];

  const videosGaleria = useMemo(() => historial.filter((h) => h.tipo === "video").slice(0, 8), [historial]);
  const imagenesGaleria = useMemo(() => historial.filter((h) => (h.tipo || "imagen") === "imagen").slice(0, 8), [historial]);

  // La duración define el costo y el tope de 15s: se lee de los metadatos apenas se elige.
  const vistaVideo = reemplazo.video?.vista;
  useEffect(() => {
    if (!vistaVideo || reemplazo.video?.duracion != null) return;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      setReemplazo((r) => (r.video?.vista === vistaVideo ? { ...r, video: { ...r.video, duracion: v.duration } } : r));
    v.src = vistaVideo;
  }, [vistaVideo, reemplazo.video?.duracion, setReemplazo]);

  const elegirVideo = (nuevo) => {
    soltar(reemplazo.video);
    cambiar({ video: nuevo });
  };
  const elegirImagen = (nueva) => {
    soltar(reemplazo.imagen);
    cambiar({ imagen: nueva });
  };

  const segundos = reemplazo.video?.duracion;
  const largo = segundos != null && segundos > ANIMATE.maxSegundosVideo;

  return (
    <div className="space-y-5">
      <div>
        <span className="etiqueta">Modo</span>
        <Segmento
          opciones={Object.entries(ANIMATE.modos).map(([valor, m]) => ({ valor, nombre: m.nombre }))}
          valor={reemplazo.modo}
          onCambio={(v) => {
            // Move solo ofrece 720p: la resolución se acomoda a la más barata del modo nuevo.
            const resoluciones = ANIMATE.modos[v].resoluciones;
            cambiar({ modo: v, resolucion: resoluciones.includes(reemplazo.resolucion) ? reemplazo.resolucion : resoluciones[0] });
          }}
        />
        <p className="mt-1.5 text-[11px] font-medium leading-snug text-grafito">
          <b className="text-tinta">{modo.nombre}:</b> {modo.explicacion}.
        </p>
      </div>

      <Paso numero="1" titulo="Video base">
        {reemplazo.video ? (
          <div className="border-[2.5px] border-tinta bg-hoja p-1.5 shadow-duroSm">
            <video key={reemplazo.video.vista} src={reemplazo.video.vista} controls playsInline className="max-h-64 w-full bg-papel" />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11.5px] font-semibold">{reemplazo.video.nombre}</p>
              <span className={`shrink-0 font-mono text-[10px] font-bold uppercase ${largo ? "bg-rojo px-1 text-hoja" : "text-grafito"}`}>
                {segundos != null ? `${segundos.toFixed(1)}s` : "…"}
              </span>
              <button onClick={() => elegirVideo(null)} className="shrink-0 font-bold opacity-70 hover:opacity-100" aria-label="Quitar video">
                ✕
              </button>
            </div>
            {largo && (
              <p className="mt-1.5 text-[11px] font-semibold text-rojo">
                Dura más de {ANIMATE.maxSegundosVideo}s: recortalo antes de subirlo. Este modelo no sirve para escenas largas.
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => inputVideo.current?.click()}
            className="w-full border-[2.5px] border-dashed border-tinta bg-hoja py-4 text-[12px] font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
          >
            + Subir un video corto (mp4 o mov, hasta {ANIMATE.maxSegundosVideo}s y {modo.maxMbVideo}MB)
          </button>
        )}
        <input
          ref={inputVideo}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) elegirVideo(entradaDesdeArchivo(e.target.files[0]));
            e.target.value = "";
          }}
        />
        {!reemplazo.video && videosGaleria.length > 0 && (
          <>
            <span className="etiqueta !mb-1">O un video de la galería</span>
            <div className="grid grid-cols-4 gap-2">
              {videosGaleria.map((f) => (
                <button
                  key={f.id}
                  title={f.prompt}
                  onClick={() => elegirVideo(entradaDesdeFicha(f))}
                  className="aspect-square overflow-hidden border-[2.5px] border-tinta opacity-80 hover:opacity-100"
                >
                  <video src={f.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}
      </Paso>

      <Paso numero="2" titulo="Personaje">
        <div className="flex gap-2.5">
          {reemplazo.imagen && (
            <div className="relative w-28 shrink-0">
              <img src={reemplazo.imagen.vista} alt="" className="aspect-[3/4] w-full border-[2.5px] border-tinta object-cover shadow-duroSm" />
              <button
                onClick={() => elegirImagen(null)}
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border-2 border-tinta bg-rojo text-[11px] font-bold leading-none text-hoja"
                aria-label="Quitar personaje"
              >
                ×
              </button>
            </div>
          )}
          <div className="grid flex-1 grid-cols-4 content-start gap-2">
            <button
              onClick={() => inputImagen.current?.click()}
              className="aspect-square border-[2.5px] border-dashed border-tinta bg-hoja text-[11px] font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
            >
              + Subir
            </button>
            {imagenesGaleria.map((f) => (
              <button
                key={f.id}
                title={f.prompt}
                onClick={() => elegirImagen(entradaDesdeFicha(f))}
                className={`aspect-square overflow-hidden border-[2.5px] border-tinta ${
                  reemplazo.imagen?.archivo === f.archivo ? "outline outline-[3px] outline-lima" : "opacity-80 hover:opacity-100"
                }`}
              >
                <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono text-[10px] font-bold uppercase text-grafito">
          jpg, png o webp · hasta {modo.maxMbImagen}MB · conviene de cuerpo entero o medio cuerpo, de frente
        </p>
        <input
          ref={inputImagen}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) elegirImagen(entradaDesdeArchivo(e.target.files[0]));
            e.target.value = "";
          }}
        />
      </Paso>

      <Paso numero="3" titulo="Generar">
        <div>
          <span className="etiqueta">Resolución {segundos != null ? `· para ${Math.ceil(segundos)}s de video` : "· costo por segundo"}</span>
          <div className="grid grid-cols-3 gap-2">
            {modo.resoluciones.map((res) => {
              const total = creditosReemplazo(ANIMATE, reemplazo.modo, res, segundos);
              return (
                <button
                  key={res}
                  onClick={() => cambiar({ resolucion: res })}
                  className={`border-[2.5px] border-tinta px-1.5 py-2 font-mono text-[11px] font-bold uppercase transition-transform hover:-translate-y-[1px]
                    ${reemplazo.resolucion === res ? "bg-lima shadow-duroSm" : "bg-hoja text-grafito hover:text-tinta"}`}
                >
                  {res}
                  <span className="block text-[10px] normal-case">
                    {total != null ? `${formatoCreditos(total)} cr` : `${modo.creditosPorSegundo[res]} cr/s`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`border-[2.5px] border-tinta px-3 py-2.5 shadow-duroSm ${caro ? "bg-rojo text-hoja" : "bg-hoja"}`}>
          <span className={`etiqueta !mb-1 ${caro ? "!text-hoja" : ""}`}>Esta tanda</span>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[12px] font-semibold">
              {modo.nombre} · {reemplazo.resolucion}
              {segundos != null && ` · ${Math.ceil(segundos)}s`}
            </span>
            <b className={`font-display text-[18px] font-black leading-none ${caro ? "" : "marcador"}`}>{costo}</b>
          </p>
        </div>

        {esperaDesde && (
          <p className="border-[2.5px] border-tinta bg-amarillo px-3 py-2 text-[12px] font-semibold">
            Esperando a Kie · <Transcurrido desde={esperaDesde} className="font-mono font-bold" /> · suele tardar unos 5 minutos
          </p>
        )}

        <div className="hidden pt-1 lg:block">
          <button className="boton-fuerte" onClick={onGenerar} disabled={generando || largo}>
            {generando ? "Generando…" : "Reemplazar personaje →"}
          </button>
        </div>
      </Paso>
    </div>
  );
}


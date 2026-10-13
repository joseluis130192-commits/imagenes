"use client";

import { useEffect, useMemo, useRef } from "react";
import { MUESTRA_VOZ, VOCES } from "@/lib/config";
import { MODELOS_KIE, buscarModeloKie } from "@/lib/proveedores";
import { entradaDesdeArchivo, entradaDesdeFicha } from "@/lib/hablar";
import { Grupo, Segmento } from "@/components/Controles";

const MODELOS_HABLAR = MODELOS_KIE.filter((m) => m.hablar);
const VOZ = buscarModeloKie("kie-elevenlabs");

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

/** Libera la URL blob: de una subida que se reemplaza, para que no quede en memoria. */
function soltar(entrada) {
  if (entrada?.vista?.startsWith("blob:")) URL.revokeObjectURL(entrada.vista);
}

function Miniatura({ tipo, src }) {
  return tipo === "video" ? (
    <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
  ) : (
    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
  );
}

export default function Hablar({ estado, set, hablar, setHablar, historial, onGenerar, generando, onGenerarVoz, generandoVoz, costo }) {
  const inputBase = useRef(null);
  const inputAudio = useRef(null);
  const muestra = useRef(null);
  const cambiar = (parcial) => setHablar((h) => ({ ...h, ...parcial }));

  const entrada = buscarModeloKie(estado.modelo)?.hablar ? buscarModeloKie(estado.modelo) : MODELOS_HABLAR[0];
  const deGaleria = useMemo(() => historial.filter((h) => h.tipo === entrada.base).slice(0, 12), [historial, entrada.base]);
  const audios = useMemo(() => historial.filter((h) => h.tipo === "audio").slice(0, 8), [historial]);

  // La duración del audio define el costo y los topes de cada modelo: se lee de los
  // metadatos apenas se elige (sirve igual para un blob: que para /api/imagen/...).
  const vistaAudio = hablar.audio?.vista;
  useEffect(() => {
    if (!vistaAudio || hablar.audio?.duracion != null) return;
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () =>
      setHablar((h) => (h.audio?.vista === vistaAudio ? { ...h, audio: { ...h.audio, duracion: a.duration } } : h));
    a.src = vistaAudio;
  }, [vistaAudio, hablar.audio?.duracion, setHablar]);

  const elegirBase = (nueva) => {
    soltar(hablar.base);
    cambiar({ base: nueva });
  };
  const elegirAudio = (nuevo) => {
    soltar(hablar.audio);
    cambiar({ audio: nuevo });
  };

  const tocarMuestra = () => {
    muestra.current?.pause();
    muestra.current = new Audio(MUESTRA_VOZ(hablar.voz));
    muestra.current.play().catch(() => {});
  };

  const creditosVoz = Math.max(1, Math.ceil((hablar.texto.length / 1000) * VOZ.creditosPorMilCaracteres));

  return (
    <div className="space-y-5">
      <div>
        <label className="etiqueta" htmlFor="modelo-hablar">
          Modelo
        </label>
        <select
          id="modelo-hablar"
          value={entrada.id}
          onChange={(e) => {
            const nuevo = buscarModeloKie(e.target.value);
            // Si cambia de "parte de imagen" a "parte de video" (o al revés), la base elegida ya no sirve.
            if (nuevo.base !== entrada.base) elegirBase(null);
            set({ modelo: nuevo.id });
          }}
          className="campo block w-full cursor-pointer truncate font-mono text-[13px]"
        >
          <optgroup label="Desde una imagen">
            {MODELOS_HABLAR.filter((m) => m.base === "imagen").map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </optgroup>
          <optgroup label="Desde un video">
            {MODELOS_HABLAR.filter((m) => m.base === "video").map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1.5 text-[11px] font-medium leading-snug text-grafito">{entrada.nota}</p>
      </div>

      <Paso numero="1" titulo={entrada.base === "video" ? "Video base" : "Imagen base"}>
        {hablar.base && (
          <div className="relative w-32">
            <div className="aspect-square border-[2.5px] border-tinta bg-hoja shadow-duroSm">
              <Miniatura tipo={entrada.base} src={hablar.base.vista} />
            </div>
            <button
              onClick={() => elegirBase(null)}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border-2 border-tinta bg-rojo text-[11px] font-bold leading-none text-hoja"
              aria-label="Quitar base"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => inputBase.current?.click()}
            className="aspect-square border-[2.5px] border-dashed border-tinta bg-hoja text-[11px] font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
          >
            + Subir
          </button>
          {deGaleria.map((f) => (
            <button
              key={f.id}
              title={f.prompt}
              onClick={() => elegirBase(entradaDesdeFicha(f))}
              className={`aspect-square overflow-hidden border-[2.5px] border-tinta transition-transform hover:-translate-y-[1px] ${
                hablar.base?.archivo === f.archivo ? "shadow-duroSm outline outline-[3px] outline-lima" : "opacity-80 hover:opacity-100"
              }`}
            >
              <Miniatura tipo={entrada.base} src={f.url} />
            </button>
          ))}
        </div>
        {!deGaleria.length && (
          <p className="text-[11px] font-medium text-grafito">
            No hay {entrada.base === "video" ? "videos" : "imágenes"} en la galería todavía: subí uno desde la compu.
          </p>
        )}
        <p className="font-mono text-[10px] font-bold uppercase text-grafito">Acepta {entrada.formatosBase.join(", ")}</p>
        <input
          ref={inputBase}
          type="file"
          accept={entrada.base === "video" ? "video/mp4,video/quicktime" : "image/png,image/jpeg,image/webp"}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) elegirBase(entradaDesdeArchivo(e.target.files[0]));
            e.target.value = "";
          }}
        />
      </Paso>

      <Paso numero="2" titulo="Audio">
        <Segmento
          opciones={[
            { valor: "archivo", nombre: "Subir audio" },
            { valor: "texto", nombre: "Texto → voz" },
          ]}
          valor={hablar.fuenteAudio}
          onCambio={(v) => cambiar({ fuenteAudio: v })}
        />

        {hablar.fuenteAudio === "archivo" ? (
          <div className="space-y-2">
            <button
              onClick={() => inputAudio.current?.click()}
              className="w-full border-[2.5px] border-dashed border-tinta bg-hoja py-3 text-[12px] font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
            >
              + Elegir mp3 o wav de la compu
            </button>
            <input
              ref={inputAudio}
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) elegirAudio(entradaDesdeArchivo(e.target.files[0]));
                e.target.value = "";
              }}
            />
            {audios.length > 0 && (
              <>
                <span className="etiqueta !mb-1 !mt-3">O una voz ya generada</span>
                <div className="space-y-1.5">
                  {audios.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => elegirAudio(entradaDesdeFicha(a))}
                      className={`block w-full truncate border-2 border-tinta px-2.5 py-1.5 text-left text-[12px] font-medium ${
                        hablar.audio?.archivo === a.archivo ? "bg-lima" : "bg-hoja text-grafito hover:text-tinta"
                      }`}
                    >
                      ♪ {a.prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={hablar.texto}
              onChange={(e) => cambiar({ texto: e.target.value })}
              maxLength={5000}
              placeholder="Lo que tiene que decir, tal cual. Se puede escribir en castellano."
              className="campo resize-y leading-relaxed"
            />
            <div>
              <label className="etiqueta" htmlFor="voz">
                Voz
              </label>
              <div className="flex gap-2">
                <select
                  id="voz"
                  value={hablar.voz}
                  onChange={(e) => cambiar({ voz: e.target.value })}
                  className="campo min-w-0 flex-1 cursor-pointer truncate text-[13px]"
                >
                  {VOCES.map((v) => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
                <button onClick={tocarMuestra} className="boton shrink-0 px-3" title="Escuchar una muestra de la voz">
                  ▶ Muestra
                </button>
              </div>
            </div>
            <div>
              <label className="etiqueta" htmlFor="velocidad">
                Velocidad · {Number(hablar.velocidad).toFixed(2)}×
              </label>
              <input
                id="velocidad"
                type="range"
                min="0.7"
                max="1.2"
                step="0.05"
                value={hablar.velocidad}
                onChange={(e) => cambiar({ velocidad: Number(e.target.value) })}
                className="w-full accent-tinta"
              />
            </div>
            <button className="boton w-full bg-lima py-2.5" onClick={onGenerarVoz} disabled={generandoVoz}>
              {generandoVoz ? "Generando voz…" : `Generar voz · ~${creditosVoz} créd.`}
            </button>
          </div>
        )}

        {hablar.audio && (
          <div className="border-[2.5px] border-tinta bg-hoja p-2.5 shadow-duroSm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-[12px] font-semibold">♪ {hablar.audio.nombre}</p>
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-grafito">
                {hablar.audio.duracion != null ? `${hablar.audio.duracion.toFixed(1)}s` : "…"}
              </span>
              <button onClick={() => elegirAudio(null)} className="shrink-0 font-bold opacity-70 hover:opacity-100" aria-label="Quitar audio">
                ✕
              </button>
            </div>
            <audio key={hablar.audio.vista} src={hablar.audio.vista} controls preload="metadata" className="w-full" />
          </div>
        )}
      </Paso>

      <Paso numero="3" titulo="Generar">
        {entrada.pidePrompt && (
          <div>
            <label className="etiqueta" htmlFor="prompt">
              Gestos y cámara (opcional)
            </label>
            <textarea
              id="prompt"
              rows={3}
              value={estado.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerar();
              }}
              placeholder="Habla a cámara con tono cálido, asiente de vez en cuando, plano fijo."
              className="campo resize-y leading-relaxed"
            />
          </div>
        )}
        {entrada.resolucionesPermitidas && (
          <Grupo
            etiqueta="Resolución"
            opciones={entrada.resolucionesPermitidas.map((r) => ({ valor: r, nombre: r }))}
            valor={hablar.resolucion}
            onCambio={(v) => cambiar({ resolucion: v })}
            columnas={2}
          />
        )}
        {entrada.modosPermitidos && (
          <div>
            <span className="etiqueta">Modo</span>
            <Segmento
              opciones={[
                { valor: "lite", nombre: "Lite · de frente" },
                { valor: "basic", nombre: "Basic · escenas" },
              ]}
              valor={hablar.modo}
              onCambio={(v) => cambiar({ modo: v })}
            />
          </div>
        )}

        <div className="hidden pt-1 lg:block">
          <button className="boton-fuerte" onClick={onGenerar} disabled={generando}>
            {generando ? "Generando…" : "Hacer hablar →"}
          </button>
          <p className="mt-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-grafito">
            Esta tanda: <span className="marcador text-tinta">{costo}</span>
          </p>
        </div>
      </Paso>
    </div>
  );
}

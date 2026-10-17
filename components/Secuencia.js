"use client";

import { useMemo, useRef, useState } from "react";
import { buscarModeloKie } from "@/lib/proveedores";
import { entradaDesdeArchivo, entradaDesdeFicha } from "@/lib/hablar";
import { MAX_IMAGENES, conUid, mover, resumenSecuencia } from "@/lib/secuencia";
import { Grupo, Segmento } from "@/components/Controles";

const PIXVERSE = buscarModeloKie("kie-pixverse-transition");

const ESTADOS_PAR = {
  cola: { texto: "en cola", clase: "bg-hoja text-grafito" },
  generando: { texto: "generando…", clase: "bg-amarillo" },
  listo: { texto: "listo ✓", clase: "bg-lima" },
  error: { texto: "falló", clase: "bg-rojo text-hoja" },
  demorado: { texto: "tardando", clase: "bg-amarillo" },
};

function soltar(entrada) {
  if (entrada?.vista?.startsWith("blob:")) URL.revokeObjectURL(entrada.vista);
}

function Titulo({ children }) {
  return <span className="etiqueta">{children}</span>;
}

/** Progreso de la última corrida: un renglón por par, con reintento solo del que falló. */
function Progreso({ corrida, generando, onReintentar, onSeguirEsperando }) {
  const listos = corrida.pares.filter((p) => p.estado === "listo").length;
  return (
    <div className="border-[2.5px] border-tinta bg-hoja p-3 shadow-duroSm">
      <p className="mb-2.5 font-display text-[15px] font-black">
        <span className="marcador">
          {listos} de {corrida.pares.length} listos
        </span>
      </p>
      <ol className="space-y-1.5">
        {corrida.pares.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className="w-14 shrink-0 font-mono text-[11px] font-bold">
              {i + 1} → {i + 2}
            </span>
            <span className={`border-2 border-tinta px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${ESTADOS_PAR[p.estado].clase}`}>
              {ESTADOS_PAR[p.estado].texto}
            </span>
            {p.estado === "error" && (
              <button onClick={() => onReintentar(i)} disabled={generando} className="boton px-2 py-0.5 text-[11px]">
                Reintentar este par
              </button>
            )}
            {p.estado === "demorado" && (
              <button onClick={() => onSeguirEsperando(i)} disabled={generando} className="boton px-2 py-0.5 text-[11px]">
                Seguir esperando
              </button>
            )}
            {p.mensaje && <p className="w-full pl-16 text-[11px] font-medium leading-snug text-grafito">{p.mensaje}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Secuencia({ secuencia, setSecuencia, historial, corrida, onGenerar, generando, onReintentar, onSeguirEsperando }) {
  const inputArchivos = useRef(null);
  const [arrastrando, setArrastrando] = useState(null);
  const cambiar = (parcial) => setSecuencia((s) => ({ ...s, ...parcial }));
  const imagenes = secuencia.imagenes;
  const lleno = imagenes.length >= MAX_IMAGENES;

  const deGaleria = useMemo(() => historial.filter((h) => (h.tipo || "imagen") === "imagen").slice(0, 12), [historial]);
  const { clips, porClip, total } = resumenSecuencia(PIXVERSE, secuencia);

  const agregar = (nuevas) =>
    setSecuencia((s) => ({ ...s, imagenes: [...s.imagenes, ...nuevas.map(conUid)].slice(0, MAX_IMAGENES) }));
  const quitar = (i) =>
    setSecuencia((s) => {
      soltar(s.imagenes[i]);
      return { ...s, imagenes: s.imagenes.filter((_, j) => j !== i) };
    });
  const reordenar = (desde, hasta) => setSecuencia((s) => ({ ...s, imagenes: mover(s.imagenes, desde, hasta) }));

  return (
    <div className="space-y-5">
      <p className="text-[11px] font-medium leading-snug text-grafito">{PIXVERSE.nota}.</p>

      <div>
        <Titulo>Imágenes en orden · {imagenes.length} de {MAX_IMAGENES}</Titulo>
        {imagenes.length > 0 ? (
          <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-3">
            {imagenes.map((img, i) => (
              <li
                key={img.uid}
                draggable
                onDragStart={() => setArrastrando(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastrando !== null) reordenar(arrastrando, i);
                  setArrastrando(null);
                }}
                onDragEnd={() => setArrastrando(null)}
                className={`relative cursor-grab border-[2.5px] border-tinta bg-hoja p-1 shadow-duroSm active:cursor-grabbing ${
                  arrastrando === i ? "opacity-40" : ""
                }`}
              >
                <span className="absolute -left-2 -top-2 z-10 grid h-6 w-6 place-items-center border-[2.5px] border-tinta bg-amarillo font-mono text-[11px] font-bold">
                  {i + 1}
                </span>
                <button
                  onClick={() => quitar(i)}
                  className="absolute -right-2 -top-2 z-10 grid h-5 w-5 place-items-center border-2 border-tinta bg-rojo text-[11px] font-bold leading-none text-hoja"
                  aria-label={`Quitar la imagen ${i + 1}`}
                >
                  ×
                </button>
                <img src={img.vista} alt="" draggable={false} className="aspect-square w-full object-cover" />
                {/* Arrastrar no anda en pantallas táctiles: las flechas reordenan igual. */}
                <div className="mt-1 flex justify-between">
                  <button
                    onClick={() => reordenar(i, i - 1)}
                    disabled={i === 0}
                    className="px-1.5 font-mono text-[12px] font-bold disabled:opacity-20"
                    aria-label="Mover antes"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => reordenar(i, i + 1)}
                    disabled={i === imagenes.length - 1}
                    className="px-1.5 font-mono text-[12px] font-bold disabled:opacity-20"
                    aria-label="Mover después"
                  >
                    →
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-[2.5px] border-dashed border-tinta bg-hoja/70 px-3 py-4 text-center text-[12px] font-medium text-grafito">
            Cargá de 2 a 8 fotos. El orden define la animación: la 1 pasa a la 2, la 2 a la 3…
          </p>
        )}
        {imagenes.length > 1 && (
          <p className="mt-2 font-mono text-[10px] font-bold uppercase text-grafito">Arrastrá o usá las flechas para cambiar el orden</p>
        )}
      </div>

      {!lleno && (
        <div>
          <Titulo>Sumar imágenes</Titulo>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => inputArchivos.current?.click()}
              className="aspect-square border-[2.5px] border-dashed border-tinta bg-hoja text-[11px] font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
            >
              + Subir
            </button>
            {deGaleria.map((f) => (
              <button
                key={f.id}
                title={f.prompt}
                onClick={() => agregar([entradaDesdeFicha(f)])}
                className="aspect-square overflow-hidden border-[2.5px] border-tinta opacity-80 transition-transform hover:-translate-y-[1px] hover:opacity-100"
              >
                <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <input
            ref={inputArchivos}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              agregar(Array.from(e.target.files || []).map(entradaDesdeArchivo));
              e.target.value = "";
            }}
          />
        </div>
      )}

      <div>
        <label className="etiqueta" htmlFor="prompt-secuencia">
          Cómo es la transición (opcional, vale para todos los pares)
        </label>
        <textarea
          id="prompt-secuencia"
          rows={3}
          value={secuencia.prompt}
          onChange={(e) => cambiar({ prompt: e.target.value })}
          placeholder="Transición suave y continua entre las dos escenas, con movimiento de cámara natural."
          className="campo resize-y leading-relaxed"
        />
      </div>

      <Grupo
        etiqueta="Calidad"
        opciones={PIXVERSE.calidadesPermitidas.map((c) => ({ valor: c, nombre: c }))}
        valor={secuencia.calidad}
        onCambio={(v) => cambiar({ calidad: v })}
        columnas={4}
      />
      <Grupo
        etiqueta="Duración de cada clip"
        opciones={PIXVERSE.duracionesPermitidas.map((d) => ({ valor: d, nombre: `${d}s` }))}
        valor={secuencia.duracion}
        onCambio={(v) => cambiar({ duracion: v })}
        columnas={4}
      />
      <div>
        <span className="etiqueta">Sonido</span>
        <Segmento
          opciones={[
            { valor: false, nombre: "Sin audio" },
            { valor: true, nombre: "Con audio" },
          ]}
          valor={secuencia.audio}
          onCambio={(v) => cambiar({ audio: v })}
        />
      </div>

      {/* Lo que se va a crear, explícito antes de generar. */}
      <div className="border-[2.5px] border-tinta bg-amarillo/50 px-3 py-2.5 shadow-duroSm">
        <p className="font-display text-[15px] font-black leading-tight">
          {imagenes.length} {imagenes.length === 1 ? "imagen" : "imágenes"} → {clips} {clips === 1 ? "clip" : "clips"}
        </p>
        <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.04em]">
          {clips > 0 ? (
            <>
              ~{porClip} créd. por clip · <span className="marcador">~{total} créd. en total</span>
            </>
          ) : (
            "Hacen falta al menos 2 imágenes"
          )}
        </p>
        <p className="mt-1 text-[10.5px] font-medium text-grafito">
          Estimado: PixVerse no publica precio. Los clips salen sueltos, el montaje va por fuera.
        </p>
      </div>

      {corrida && (
        <Progreso corrida={corrida} generando={generando} onReintentar={onReintentar} onSeguirEsperando={onSeguirEsperando} />
      )}

      <div className="hidden pt-1 lg:block">
        <button className="boton-fuerte" onClick={onGenerar} disabled={generando}>
          {generando ? "Generando…" : `Generar ${clips || ""} ${clips === 1 ? "clip" : "clips"} →`}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { ASPECTOS_VIDEO, CALIDADES, DURACIONES_VIDEO, ESTILOS, FONDOS, FORMATOS, RESOLUCIONES_VIDEO, TAMANOS } from "@/lib/config";
import { MODELOS_KIE, ajustesMasBaratos, buscarModeloKie, costoVideo, etiquetaCostoVideo } from "@/lib/proveedores";
import Plegable from "@/components/Plegable";

const CANTIDADES = [1, 2, 3, 4].map((n) => ({ valor: n, nombre: String(n) }));

// El selector se agrupa por uso: "Realista", "Edición", "Económicos", "Retoque". En video
// los grupos son "Económicos" y "Calidad alta", y adentro van de más barato a más caro.
const GRUPOS_ORDEN = ["Realista", "Edición", "Económicos", "Calidad alta", "Retoque"];

/** Para ordenar los de video por su combinación más barata; los sin confirmar, al final. */
const costoMinimo = (m) => costoVideo(m, ajustesMasBaratos(m)).creditos ?? Infinity;

export function Segmento({ opciones, valor, onCambio, columnas = 2 }) {
  return (
    <div className={`grid ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onCambio(o.valor)}
          className={`border-[2.5px] border-tinta py-2.5 font-display text-[14px] font-extrabold transition-transform
            ${
              valor === o.valor
                ? "bg-lima shadow-duroSm"
                : "bg-hoja text-grafito hover:-translate-y-[1px] hover:text-tinta"
            }`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

export function Grupo({ opciones, valor, onCambio, columnas = 4, etiqueta }) {
  const colClase = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columnas] || "grid-cols-4";
  return (
    <div>
      {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      <div className={`grid ${colClase} gap-2`}>
        {opciones.map((o) => (
          <button
            key={o.valor}
            title={o.nombre}
            onClick={() => onCambio(o.valor)}
            className={`border-[2.5px] border-tinta px-1.5 py-2 font-mono text-[11px] font-bold uppercase
              transition-transform hover:-translate-y-[1px]
              ${valor === o.valor ? "bg-lima shadow-duroSm" : "bg-hoja text-grafito hover:text-tinta"}`}
          >
            {o.corto || o.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Controles({ estado, set, archivos, setArchivos, onGenerar, generando, costo, tanda, panelHablar, panelSecuencia }) {
  const inputArchivos = useRef(null);

  // Una URL por archivo, liberada al cambiar la lista: evita que se acumulen en memoria.
  const vistasPrevias = useMemo(() => archivos.map((a) => URL.createObjectURL(a)), [archivos]);
  useEffect(() => () => vistasPrevias.forEach((u) => URL.revokeObjectURL(u)), [vistasPrevias]);

  const agregarArchivos = (lista) => {
    const nuevos = Array.from(lista || []).filter((f) => f.type.startsWith("image/"));
    setArchivos((previos) => [...previos, ...nuevos].slice(0, 6));
  };

  // Fallback defensivo: si estado.modelo quedó con un id inválido (no debería pasar,
  // ver reusar() en page.js) mejor mostrar el primer modelo que romper el panel.
  const entradaKie = buscarModeloKie(estado.modelo) || MODELOS_KIE[0];
  const esVideo = entradaKie.tipo === "video";
  const controlesKie = entradaKie.controles || {};
  const controlesVideo = entradaKie.controlesVideo || {};
  const mostrarCalidad = controlesKie.calidad;
  const mostrarCantidad = controlesKie.cantidad;
  const mostrarFormato = controlesKie.formato;
  const mostrarFondo = controlesKie.fondo;
  const opcionesFormato = controlesKie.formatosPermitidos
    ? FORMATOS.filter((f) => controlesKie.formatosPermitidos.includes(f.valor))
    : FORMATOS;

  const tamanoCorto = TAMANOS.find((t) => t.valor === estado.tamano)?.corto || estado.tamano;
  const resumenAjustes = esVideo ? `${tanda.detalle} · ${costo}` : `${entradaKie.nombre} · ${tamanoCorto} · ${costo}`;

  // Elegir un modelo de video arranca siempre en su combinación más barata (duración
  // mínima, resolución más baja, sin audio): subir de calidad es una decisión aparte.
  const elegirModelo = (id, extra = {}) => {
    const m = buscarModeloKie(id);
    set({ modelo: id, cantidad: 1, ...extra, ...(m?.tipo === "video" && id !== estado.modelo ? ajustesMasBaratos(m) : {}) });
  };

  // Agrupado por uso: los modelos que no ofrecen el modo actual (ej. Z-Image no edita,
  // Recraft/Topaz/el segment-map de Grok no generan desde cero) directamente no aparecen.
  // En modo "video" solo entran los modelos de tipo video, filtrados además por si el
  // sub-modo activo es texto→video (generar) o imagen→video (editar).
  const grupos = useMemo(() => {
    const mapa = Object.fromEntries(GRUPOS_ORDEN.map((g) => [g, []]));
    MODELOS_KIE.forEach((m) => {
      if (estado.modo === "video") {
        if (m.tipo !== "video") return;
        const capacidad = estado.modoVideo === "imagen" ? "editar" : "generar";
        if (!m[capacidad]) return;
      } else {
        if (m.tipo !== "imagen") return;
        if (!m[estado.modo]) return;
      }
      const grupo = GRUPOS_ORDEN.includes(m.grupo) ? m.grupo : "Realista";
      // En video el costo va en la misma opción, visible sin abrir nada.
      const etiqueta = m.tipo === "video" ? `${m.nombre} — ${etiquetaCostoVideo(m)}` : m.nombre;
      mapa[grupo].push({ valor: m.id, etiqueta, orden: m.tipo === "video" ? costoMinimo(m) : 0 });
    });
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => a.orden - b.orden));
    return mapa;
  }, [estado.modo, estado.modoVideo]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <Segmento
        opciones={[
          { valor: "generar", nombre: "Generar" },
          { valor: "editar", nombre: "Editar" },
          { valor: "video", nombre: "Video" },
          { valor: "hablar", nombre: "Hablar" },
          { valor: "secuencia", nombre: "Secuencia" },
        ]}
        columnas={3}
        valor={estado.modo}
        onCambio={(v) => {
          // Secuencia usa siempre PixVerse: no hay modelo para elegir.
          if (v === "secuencia") {
            set({ modo: v, modelo: "kie-pixverse-transition" });
            return;
          }
          if (v === "hablar") {
            const alternativa = MODELOS_KIE.find((m) => m.hablar)?.id;
            set({ modo: v, modelo: entradaKie.hablar ? estado.modelo : alternativa });
            return;
          }
          if (v === "video") {
            const capacidad = estado.modoVideo === "imagen" ? "editar" : "generar";
            const yaSirve = entradaKie.tipo === "video" && entradaKie[capacidad];
            const alternativa = MODELOS_KIE.find((m) => m.tipo === "video" && m[capacidad])?.id;
            elegirModelo(yaSirve ? estado.modelo : alternativa || estado.modelo, { modo: v });
            return;
          }
          // Si el modelo elegido no ofrece el modo al que se cambia (Recraft/Topaz/el
          // segment-map de Grok no generan; Z-Image/Seedream no editan; los de video no
          // aplican acá), no puede quedar seleccionado ahí: se cae a otro que sí lo ofrezca.
          const sinSoporte = entradaKie.tipo !== "imagen" || !entradaKie[v];
          const alternativa = MODELOS_KIE.find((m) => m.tipo === "imagen" && m[v])?.id;
          set(sinSoporte && alternativa ? { modo: v, modelo: alternativa } : { modo: v });
        }}
      />

      {/* "Hablar" y "Secuencia" tienen formularios propios (components/Hablar.js y Secuencia.js). */}
      {estado.modo === "hablar" && panelHablar}
      {estado.modo === "secuencia" && panelSecuencia}

      {estado.modo === "video" && (
        <Segmento
          opciones={[
            { valor: "texto", nombre: "Texto → Video" },
            { valor: "imagen", nombre: "Imagen → Video" },
          ]}
          valor={estado.modoVideo}
          onCambio={(v) => {
            const capacidad = v === "imagen" ? "editar" : "generar";
            const yaSirve = entradaKie.tipo === "video" && entradaKie[capacidad];
            const alternativa = MODELOS_KIE.find((m) => m.tipo === "video" && m[capacidad])?.id;
            elegirModelo(yaSirve ? estado.modelo : alternativa || estado.modelo, { modoVideo: v });
          }}
        />
      )}

      {estado.modo !== "hablar" && estado.modo !== "secuencia" && (
        <>
          {(estado.modo === "editar" || (estado.modo === "video" && estado.modoVideo === "imagen")) && (
            <div>
              <span className="etiqueta">Imágenes de referencia</span>
              <div className="flex flex-wrap gap-2.5">
                {archivos.map((a, i) => (
                  <div key={i} className="relative">
                    <img
                      src={vistasPrevias[i]}
                      alt=""
                      className="h-16 w-16 border-[2.5px] border-tinta object-cover shadow-duroSm"
                    />
                    <button
                      onClick={() => setArchivos(archivos.filter((_, j) => j !== i))}
                      className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border-2 border-tinta
                                 bg-rojo text-[11px] font-bold leading-none text-hoja"
                      aria-label="Quitar imagen"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {archivos.length < 6 && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      agregarArchivos(e.dataTransfer.files);
                    }}
                    onClick={() => inputArchivos.current?.click()}
                    className="flex h-16 min-w-[128px] flex-1 cursor-pointer items-center justify-center
                               border-[2.5px] border-dashed border-tinta bg-hoja text-center text-[11px]
                               font-semibold text-grafito hover:bg-lima/25 hover:text-tinta"
                  >
                    + Agregar imagen
                  </div>
                )}
              </div>
              <input
                ref={inputArchivos}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => agregarArchivos(e.target.files)}
              />
            </div>
          )}

          <div>
            <label className="etiqueta" htmlFor="prompt">
              {estado.modo === "editar" ? "Qué cambiar" : "Prompt"}
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={estado.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerar();
              }}
              placeholder={
                estado.modo === "video"
                  ? "Describí la escena: qué pasa, cómo se mueve la cámara, qué acción ocurre."
                  : estado.modo === "editar"
                  ? "Sacá el fondo y dejá la figura sobre blanco."
                  : "Describí la imagen: qué se ve, en qué estilo, con qué encuadre y qué colores."
              }
              className="campo resize-y leading-relaxed lg:min-h-[132px]"
            />
          </div>

          <div>
            <span className="etiqueta">Estilo</span>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-wrap lg:overflow-visible">
              {ESTILOS.map((e) => {
                const activo = estado.prompt.includes(e.texto);
                return (
                  <button
                    key={e.nombre}
                    onClick={() =>
                      set({
                        prompt: activo
                          ? estado.prompt.replace(`, ${e.texto}`, "").replace(e.texto, "").trim()
                          : `${estado.prompt.trim()}${estado.prompt.trim() ? ", " : ""}${e.texto}`,
                      })
                    }
                    className={`shrink-0 border-[2.5px] border-tinta px-2.5 py-1.5 text-[12px] font-bold transition-transform
                      hover:-translate-y-[1px]
                      ${activo ? "bg-lima shadow-duroSm" : "bg-hoja text-grafito hover:text-tinta"}`}
                  >
                    {e.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <Plegable titulo="Ajustes" resumen={resumenAjustes}>
            <div>
              <label className="etiqueta" htmlFor="modelo">
                Modelo
              </label>
              <select
                id="modelo"
                value={estado.modelo}
                onChange={(e) => elegirModelo(e.target.value)}
                className="campo block w-full cursor-pointer truncate font-mono text-[13px]"
              >
                {GRUPOS_ORDEN.filter((g) => grupos[g].length).map((g) => (
                  <optgroup key={g} label={g}>
                    {grupos[g].map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {entradaKie.nota && (
                <p className="mt-1.5 text-[11px] font-medium leading-snug text-grafito">{entradaKie.nota}</p>
              )}
            </div>

            {esVideo ? (
              <>
                <Grupo
                  etiqueta="Duración"
                  opciones={DURACIONES_VIDEO.filter((d) => (controlesVideo.duracionesPermitidas || []).includes(d.valor))}
                  valor={estado.duracion}
                  onCambio={(v) => set({ duracion: v })}
                  columnas={4}
                />
                {controlesVideo.resolucionesPermitidas && (
                  <Grupo
                    etiqueta="Resolución"
                    opciones={RESOLUCIONES_VIDEO.filter((r) => controlesVideo.resolucionesPermitidas.includes(r.valor))}
                    valor={estado.resolucion}
                    onCambio={(v) => set({ resolucion: v })}
                    columnas={3}
                  />
                )}
                {controlesVideo.aspectosPermitidos && (
                  <Grupo
                    etiqueta="Aspecto"
                    opciones={ASPECTOS_VIDEO.filter((a) => controlesVideo.aspectosPermitidos.includes(a.valor))}
                    valor={estado.aspectoVideo}
                    onCambio={(v) => set({ aspectoVideo: v })}
                    columnas={3}
                  />
                )}
                {controlesVideo.sonido && (
                  <div>
                    <span className="etiqueta">Sonido</span>
                    <Segmento
                      opciones={[
                        { valor: true, nombre: "Con audio" },
                        { valor: false, nombre: "Sin audio" },
                      ]}
                      valor={estado.sonido}
                      onCambio={(v) => set({ sonido: v })}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {mostrarCalidad && (
                  <Grupo etiqueta="Calidad" opciones={CALIDADES} valor={estado.calidad} onCambio={(v) => set({ calidad: v })} columnas={4} />
                )}

                <Grupo etiqueta="Tamaño" opciones={TAMANOS} valor={estado.tamano} onCambio={(v) => set({ tamano: v })} columnas={4} />

                {mostrarCantidad && (
                  <Grupo etiqueta="Cantidad" opciones={CANTIDADES} valor={estado.cantidad} onCambio={(v) => set({ cantidad: v })} columnas={4} />
                )}

                {mostrarFormato && (
                  <Grupo etiqueta="Formato" opciones={opcionesFormato} valor={estado.formato} onCambio={(v) => set({ formato: v })} columnas={3} />
                )}

                {estado.modo === "generar" && mostrarFondo && (
                  <Grupo etiqueta="Fondo" opciones={FONDOS} valor={estado.fondo} onCambio={(v) => set({ fondo: v })} columnas={3} />
                )}
              </>
            )}
          </Plegable>

          {/* El costo de ESTA tanda con los ajustes de ahora, siempre a la vista arriba del
              botón. Más de 100 créditos o un precio sin confirmar se resalta (y pide confirmación). */}
          <div
            className={`border-[2.5px] border-tinta px-3 py-2.5 shadow-duroSm ${
              tanda.caro ? "bg-rojo text-hoja" : "bg-hoja"
            }`}
          >
            <span className={`etiqueta !mb-1 ${tanda.caro ? "!text-hoja" : ""}`}>Esta tanda</span>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 text-[12px] font-semibold">{tanda.detalle}</span>
              <b className={`font-display text-[18px] font-black leading-none ${tanda.caro ? "" : "marcador"}`}>{costo}</b>
            </p>
            {tanda.aviso && <p className="mt-1.5 text-[11px] font-semibold leading-snug">{tanda.aviso}</p>}
          </div>

          <div className="hidden pt-1 lg:block">
            <button className="boton-fuerte" onClick={onGenerar} disabled={generando || !tanda.disponible}>
              {generando ? "Generando…" : estado.modo === "video" ? "Generar video →" : estado.modo === "editar" ? "Aplicar cambios →" : "Generar →"}
            </button>
            <p className="mt-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-grafito">Ctrl + Enter</p>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { CALIDADES, ESTILOS, FONDOS, FORMATOS, TAMANOS } from "@/lib/config";
import { MODELOS_KIE, buscarModeloKie, esModeloKie } from "@/lib/proveedores";
import Plegable from "@/components/Plegable";

const CANTIDADES = [1, 2, 3, 4].map((n) => ({ valor: n, nombre: String(n) }));

// El selector se agrupa por uso, no por proveedor. Los modelos de OpenAI (genéricos,
// sirven tanto para foto realista como para editar) van siempre en "Realista".
const GRUPOS_ORDEN = ["Realista", "Edición", "Económicos", "Retoque"];

function Segmento({ opciones, valor, onCambio }) {
  return (
    <div className="grid grid-cols-2 gap-2">
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

function Grupo({ opciones, valor, onCambio, columnas = 4, etiqueta }) {
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

export default function Controles({ estado, set, modelos, archivos, setArchivos, onGenerar, generando, costo }) {
  const inputArchivos = useRef(null);

  // Una URL por archivo, liberada al cambiar la lista: evita que se acumulen en memoria.
  const vistasPrevias = useMemo(() => archivos.map((a) => URL.createObjectURL(a)), [archivos]);
  useEffect(() => () => vistasPrevias.forEach((u) => URL.revokeObjectURL(u)), [vistasPrevias]);

  const agregarArchivos = (lista) => {
    const nuevos = Array.from(lista || []).filter((f) => f.type.startsWith("image/"));
    setArchivos((previos) => [...previos, ...nuevos].slice(0, 6));
  };

  const entradaKie = buscarModeloKie(estado.modelo);
  const controlesKie = entradaKie?.controles;
  const mostrarCalidad = !controlesKie || controlesKie.calidad;
  const mostrarCantidad = !controlesKie || controlesKie.cantidad;
  const mostrarFormato = !controlesKie || controlesKie.formato;
  const mostrarFondo = !controlesKie || controlesKie.fondo;
  const opcionesFormato =
    controlesKie?.formatosPermitidos
      ? FORMATOS.filter((f) => controlesKie.formatosPermitidos.includes(f.valor))
      : FORMATOS;

  const tamanoCorto = TAMANOS.find((t) => t.valor === estado.tamano)?.corto || estado.tamano;
  const resumenAjustes = entradaKie
    ? `${entradaKie.nombre} · Kie · ${tamanoCorto} · ${entradaKie.creditos} créd.`
    : `${estado.modelo.replace("gpt-image-", "img ")} · ${
        CALIDADES.find((c) => c.valor === estado.calidad)?.nombre || estado.calidad
      } · ${tamanoCorto} · ${estado.cantidad}× · ${estado.formato.toUpperCase()}`;

  // Agrupado por uso: los de Kie que no ofrecen el modo actual (ej. Z-Image no edita,
  // Recraft/Topaz/el segment-map de Grok no generan desde cero) directamente no aparecen.
  const grupos = useMemo(() => {
    const mapa = Object.fromEntries(GRUPOS_ORDEN.map((g) => [g, []]));
    modelos.forEach((m) => mapa.Realista.push({ valor: m, etiqueta: m }));
    MODELOS_KIE.forEach((m) => {
      if (estado.modo === "generar" && !m.generar) return;
      if (estado.modo === "editar" && !m.editar) return;
      const grupo = GRUPOS_ORDEN.includes(m.grupo) ? m.grupo : "Realista";
      mapa[grupo].push({ valor: m.id, etiqueta: m.nombre });
    });
    return mapa;
  }, [modelos, estado.modo]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <Segmento
        opciones={[
          { valor: "generar", nombre: "Generar" },
          { valor: "editar", nombre: "Editar" },
        ]}
        valor={estado.modo}
        onCambio={(v) => {
          // Si el modelo elegido no ofrece el modo al que se cambia (Recraft/Topaz/el
          // segment-map de Grok no generan; Z-Image/Seedream no editan), no puede quedar
          // seleccionado ahí: se cae a OpenAI, que sirve para los dos modos.
          const sinSoporte = entradaKie && !entradaKie[v];
          set(sinSoporte ? { modo: v, modelo: modelos[0] || "gpt-image-1-mini" } : { modo: v });
        }}
      />

      {estado.modo === "editar" && (
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
            estado.modo === "editar"
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
            onChange={(e) => {
              const v = e.target.value;
              set(esModeloKie(v) ? { modelo: v, cantidad: 1 } : { modelo: v });
            }}
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
          {entradaKie?.nota && (
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-grafito">{entradaKie.nota}</p>
          )}
        </div>

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
      </Plegable>

      <div className="hidden pt-1 lg:block">
        <button className="boton-fuerte" onClick={onGenerar} disabled={generando}>
          {generando ? "Generando…" : estado.modo === "editar" ? "Aplicar cambios →" : "Generar →"}
        </button>
        <p className="mt-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-grafito">
          Esta tanda: <span className="marcador text-tinta">{costo}</span>
          <span className="mx-2">·</span>Ctrl + Enter
        </p>
      </div>
    </div>
  );
}

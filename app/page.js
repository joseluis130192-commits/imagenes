"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BarraAccion from "@/components/BarraAccion";
import Controles from "@/components/Controles";
import Galeria from "@/components/Galeria";
import Medidor from "@/components/Medidor";
import Visor from "@/components/Visor";
import { MODELOS_BASE, precioUnitario } from "@/lib/config";

const ESTADO_INICIAL = {
  modo: "generar",
  prompt: "",
  modelo: "gpt-image-1-mini",
  calidad: "medium",
  tamano: "1024x1024",
  cantidad: 1,
  formato: "png",
  fondo: "auto",
};

export default function Pagina() {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [modelos, setModelos] = useState(MODELOS_BASE);
  const [archivos, setArchivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [aviso, setAviso] = useState(null);
  const [hayKey, setHayKey] = useState(true);
  const [presupuesto, setPresupuesto] = useState(2);
  const [visor, setVisor] = useState(-1);

  const set = (parcial) => setEstado((e) => ({ ...e, ...parcial }));

  /* ------------------------------------------------------------ arranque */
  useEffect(() => {
    const guardado = Number(localStorage.getItem("presupuesto"));
    if (guardado > 0) setPresupuesto(guardado);

    fetch("/api/estado")
      .then((r) => r.json())
      .then((d) => {
        setHayKey(d.key);
        if (!d.key) {
          setAviso({
            tipo: "ambar",
            texto: "Falta la API key. Copiá .env.ejemplo a .env.local, pegá tu key en OPENAI_API_KEY y reiniciá el servidor.",
          });
        }
      })
      .catch(() => {});

    fetch("/api/modelos")
      .then((r) => r.json())
      .then((d) => {
        if (d.modelos?.length) {
          setModelos(d.modelos);
          set({ modelo: d.modelos.find((m) => m.includes("mini")) || d.modelos[0] });
        }
      })
      .catch(() => {});

    fetch("/api/historial")
      .then((r) => r.json())
      .then((d) => setHistorial(d.historial || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("presupuesto", String(presupuesto));
  }, [presupuesto]);

  /* -------------------------------------------------------------- gasto */
  const { imagenesHoy, gastoHoy } = useMemo(() => {
    const hoy = new Date().toDateString();
    const delDia = historial.filter((h) => new Date(h.fecha).toDateString() === hoy);
    return {
      imagenesHoy: delDia.length,
      gastoHoy: delDia.reduce((suma, h) => suma + precioUnitario(h.modelo, h.calidad, h.tamano), 0),
    };
  }, [historial]);

  const costoTanda = precioUnitario(estado.modelo, estado.calidad, estado.tamano) * estado.cantidad;

  /* ------------------------------------------------------------ generar */
  const generar = async () => {
    if (generando) return;
    if (!estado.prompt.trim()) {
      setAviso({ tipo: "ambar", texto: "Escribí un prompt antes de generar." });
      return;
    }
    if (estado.modo === "editar" && !archivos.length) {
      setAviso({ tipo: "ambar", texto: "Subí al menos una imagen de referencia para editar." });
      return;
    }

    setAviso(null);
    setGenerando(true);
    setPendientes(estado.cantidad);

    try {
      let respuesta;
      if (estado.modo === "editar") {
        const forma = new FormData();
        forma.append("prompt", estado.prompt);
        forma.append("modelo", estado.modelo);
        forma.append("calidad", estado.calidad);
        forma.append("tamano", estado.tamano);
        forma.append("formato", estado.formato);
        forma.append("cantidad", String(estado.cantidad));
        archivos.forEach((a) => forma.append("imagenes", a));
        respuesta = await fetch("/api/editar", { method: "POST", body: forma });
      } else {
        respuesta = await fetch("/api/generar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(estado),
        });
      }

      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setAviso({ tipo: "error", texto: datos.error || "OpenAI rechazó el pedido." });
        return;
      }
      setHistorial((h) => [...datos.imagenes, ...h]);
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo hablar con el servidor. ¿Sigue corriendo npm run dev?" });
    } finally {
      setGenerando(false);
      setPendientes(0);
    }
  };

  /* ------------------------------------------------------------ acciones */
  const borrar = async (imagen) => {
    const previo = historial;
    setHistorial((h) => h.filter((x) => x.id !== imagen.id));
    const r = await fetch("/api/borrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: imagen.id }),
    });
    if (!r.ok) {
      setHistorial(previo);
      setAviso({ tipo: "error", texto: "No se pudo borrar la imagen." });
    }
  };

  const reusar = (imagen) => {
    set({ prompt: imagen.prompt, modelo: imagen.modelo, tamano: imagen.tamano });
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("prompt")?.focus();
  };

  const mover = useCallback(
    (paso) => setVisor((i) => (historial.length ? (i + paso + historial.length) % historial.length : -1)),
    [historial.length]
  );

  /* -------------------------------------------------------------- vista */
  return (
    <div className="min-h-screen sm:pl-[70px]">
      {/* franja de estado, arriba de todo */}
      <div className="sticky top-0 z-50 -ml-0 border-b-[3px] border-tinta bg-amarillo px-5 py-2 sm:-ml-[70px] sm:pl-[76px]">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
          <span className={hayKey ? "text-tinta" : "text-rojo"}>●</span>{" "}
          {hayKey ? "Conectado a la API de OpenAI" : "Sin API key configurada"}
          <span className="mx-2 hidden sm:inline">·</span>
          <span className="hidden sm:inline">Modelo: {estado.modelo}</span>
        </p>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-5 border-b-[3px] border-tinta px-4 py-4 sm:px-6 sm:py-6">
        <div>
          <h1 className="font-display text-[24px] font-black leading-[0.95] tracking-[-0.035em] sm:text-[34px]">
            Taller de <span className="marcador">imágenes</span>
          </h1>
          <p className="mt-2.5 font-mano text-[19px] leading-none text-rojo sm:text-[22px]">
            uso interno · pagás por imagen, no por mes
          </p>
        </div>
        <Medidor
          imagenesHoy={imagenesHoy}
          gastoHoy={gastoHoy}
          presupuesto={presupuesto}
          onPresupuesto={setPresupuesto}
        />
      </header>

      <main className="grid items-start lg:grid-cols-[368px_1fr]">
        <section className="border-b-[3px] border-tinta px-4 py-6 sm:px-6 lg:sticky lg:top-[46px] lg:border-b-0 lg:border-r-[3px] lg:pb-16">
          <Controles
            estado={estado}
            set={set}
            modelos={modelos}
            archivos={archivos}
            setArchivos={setArchivos}
            onGenerar={generar}
            generando={generando}
            costo={costoTanda}
          />
        </section>

        <section className="min-w-0 px-4 py-6 pb-28 sm:px-6 lg:pb-20">
          {aviso && (
            <div
              className={`mb-6 flex items-start gap-3 border-[2.5px] border-tinta px-3.5 py-2.5 text-[13px]
                          font-semibold leading-relaxed shadow-duroSm ${
                            aviso.tipo === "ambar" ? "bg-amarillo" : "bg-rojo text-hoja"
                          }`}
            >
              <p className="flex-1 whitespace-pre-wrap break-words">{aviso.texto}</p>
              <button onClick={() => setAviso(null)} className="font-bold opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
                ✕
              </button>
            </div>
          )}

          <Galeria
            imagenes={historial}
            pendientes={pendientes}
            tamano={estado.tamano}
            onAbrir={(img) => setVisor(historial.findIndex((h) => h.id === img.id))}
            onReusar={reusar}
            onBorrar={borrar}
          />
        </section>
      </main>

      <BarraAccion modo={estado.modo} generando={generando} costo={costoTanda} onGenerar={generar} />

      {visor >= 0 && historial[visor] && (
        <Visor
          imagen={historial[visor]}
          onCerrar={() => setVisor(-1)}
          onAnterior={() => mover(-1)}
          onSiguiente={() => mover(1)}
        />
      )}
    </div>
  );
}

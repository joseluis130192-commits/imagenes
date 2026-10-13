"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BarraAccion from "@/components/BarraAccion";
import Controles from "@/components/Controles";
import Galeria from "@/components/Galeria";
import Hablar from "@/components/Hablar";
import Medidor from "@/components/Medidor";
import Visor from "@/components/Visor";
import { MODELOS_KIE, buscarModeloKie, creditosHablar } from "@/lib/proveedores";
import { HABLAR_INICIAL, entradaDesdeFicha, subirEntrada, validarHablar } from "@/lib/hablar";

const ESTADO_INICIAL = {
  modo: "generar",
  prompt: "",
  modelo: MODELOS_KIE.find((m) => m.tipo === "imagen" && m.generar)?.id || MODELOS_KIE[0].id,
  calidad: "medium",
  tamano: "1024x1024",
  cantidad: 1,
  formato: "png",
  fondo: "auto",
  modoVideo: "texto",
  duracion: 5,
  resolucion: "720p",
  aspectoVideo: "16:9",
  sonido: true,
};

export default function Pagina() {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [archivos, setArchivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [aviso, setAviso] = useState(null);
  const [hayKey, setHayKey] = useState(true);
  const [presupuesto, setPresupuesto] = useState(50);
  const [visor, setVisor] = useState(-1);
  const [creditosKie, setCreditosKie] = useState(0);
  const [saldoKie, setSaldoKie] = useState(null);
  const [hablar, setHablar] = useState(HABLAR_INICIAL);
  const [generandoVoz, setGenerandoVoz] = useState(false);

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
            texto: "Falta la API key de Kie. Copiá .env.ejemplo a .env.local, pegá tu key en KIE_API_KEY y reiniciá el servidor.",
          });
        }
      })
      .catch(() => {});

    fetch("/api/historial")
      .then((r) => r.json())
      .then((d) => setHistorial(d.historial || []))
      .catch(() => {});

    fetch("/api/kie/creditos")
      .then((r) => r.json())
      .then((d) => setSaldoKie(typeof d.saldo === "number" ? d.saldo : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("presupuesto", String(presupuesto));
  }, [presupuesto]);

  /* -------------------------------------------------------------- gasto */
  // Los créditos reales solo se conocen cuando termina cada tarea (creditsConsumed no
  // se guarda en la tabla), así que el gasto es de la sesión actual, no del día entero
  // acumulado entre recargas: `imagenesHoy` sí puede salir del historial (tiene fecha).
  const imagenesHoy = useMemo(() => {
    const hoy = new Date().toDateString();
    return historial.filter((h) => new Date(h.fecha).toDateString() === hoy).length;
  }, [historial]);

  const entradaKieActual = buscarModeloKie(estado.modelo) || MODELOS_KIE[0];
  // Los de lipsync cobran según el largo del audio: hasta que hay audio se muestra la tarifa.
  const costoTanda = entradaKieActual.hablar
    ? hablar.audio?.duracion != null
      ? `~${creditosHablar(entradaKieActual, hablar.audio.duracion, hablar.resolucion)} créd.`
      : `${creditosHablar(entradaKieActual, 1, hablar.resolucion)} créd./s`
    : `${entradaKieActual.creditos} créd.`;

  /* ------------------------------------------------------- tareas de Kie */
  // Kie no devuelve la imagen en la respuesta: solo un taskId. Hay que pollear
  // hasta que la tarea termine. La mayoría termina en menos de 30s, pero el tope de
  // intentos cubre el caso de que se cuelgue del lado de ellos. Devuelve la ficha
  // guardada (o nada si falló), para que "Hablar" pueda usar la voz recién generada.
  const pollearTareaKie = async (taskId, tipo = "imagen") => {
    let ultimoEstado = "desconocido";
    // Un video tarda mucho más que una imagen: 150 intentos de 2s son 5 minutos, contra
    // los 3 minutos (90 intentos) que alcanzan para el resto de los modelos. El lipsync
    // es todavía más lento (Infinitalk y Kling Avatar pueden pasar los 5 minutos): 10.
    const maxIntentos = { hablar: 300, video: 150 }[tipo] || 90;

    for (let intento = 0; intento < maxIntentos; intento++) {
      await new Promise((r) => setTimeout(r, 2000));

      let datos;
      try {
        const resp = await fetch(`/api/tarea/${taskId}`);
        datos = await resp.json();
      } catch {
        continue; // fallo de red puntual al pollear: seguimos intentando
      }

      if (datos.estado === "listo") {
        setHistorial((h) => [datos.imagen, ...h]);
        if (typeof datos.imagen?.creditosConsumidos === "number") {
          setCreditosKie((c) => c + datos.imagen.creditosConsumidos);
        }
        return datos.imagen;
      }
      if (datos.estado === "error") {
        setAviso({ tipo: "error", texto: `${datos.mensaje} (tarea ${taskId})` });
        return;
      }
      ultimoEstado = datos.ultimoEstado || ultimoEstado;
    }

    // Se agotaron los intentos, pero la tarea puede haber terminado del lado de Kie
    // igual (por eso el botón: no hay que perderla, alcanza con volver a consultar).
    setAviso({
      tipo: "error",
      texto: `Kie está tardando más de lo esperado (último estado: "${ultimoEstado}"). La tarea puede seguir corriendo del lado de ellos — taskId: ${taskId}.`,
      accion: {
        etiqueta: "Reintentar",
        onClick: () => {
          setAviso(null);
          setGenerando(true);
          setPendientes(1);
          pollearTareaKie(taskId, tipo).finally(() => {
            setGenerando(false);
            setPendientes(0);
          });
        },
      },
    });
  };

  /* ------------------------------------------------------------- hablar */
  const generarVoz = async () => {
    if (generandoVoz) return;
    const texto = hablar.texto.trim();
    if (!texto) {
      setAviso({ tipo: "ambar", texto: "Escribí el texto que tiene que decir la voz." });
      return;
    }

    setAviso(null);
    setGenerandoVoz(true);
    try {
      const respuesta = await fetch("/api/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, voz: hablar.voz, velocidad: hablar.velocidad }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setAviso({ tipo: "error", texto: datos.error || "Kie rechazó el pedido de voz." });
        return;
      }
      // La voz queda en la galería (tipo "audio") y además cargada en el paso 2, lista para escuchar.
      const ficha = await pollearTareaKie(datos.taskId, "audio");
      if (ficha) setHablar((h) => ({ ...h, audio: entradaDesdeFicha(ficha) }));
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo hablar con el servidor. ¿Sigue corriendo npm run dev?" });
    } finally {
      setGenerandoVoz(false);
    }
  };

  const generarHablado = async () => {
    const problema = validarHablar(entradaKieActual, hablar);
    if (problema) {
      setAviso({ tipo: "ambar", texto: problema });
      return;
    }

    // Igual que en video: es caro, así que se confirma antes de dispararlo.
    const segundos = hablar.audio.duracion;
    const estimado =
      segundos != null
        ? `~${creditosHablar(entradaKieActual, segundos, hablar.resolucion)} créditos estimados para ${segundos.toFixed(1)}s de audio`
        : `~${creditosHablar(entradaKieActual, 1, hablar.resolucion)} créditos estimados por segundo de audio`;
    if (!window.confirm(`Vas a generar un video hablado con ${entradaKieActual.nombre} (${estimado}). ¿Continuar?`)) return;

    setAviso(null);
    setGenerando(true);
    setPendientes(1);
    try {
      const [base, audio] = await Promise.all([subirEntrada(hablar.base), subirEntrada(hablar.audio)]);
      const respuesta = await fetch("/api/hablar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelo: entradaKieActual.id,
          prompt: estado.prompt,
          base,
          audio,
          resolucion: hablar.resolucion,
          modo: hablar.modo,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setAviso({ tipo: "error", texto: datos.error || "Kie rechazó el pedido." });
        return;
      }
      await pollearTareaKie(datos.taskId, "hablar");
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo hablar con el servidor." });
    } finally {
      setGenerando(false);
      setPendientes(0);
    }
  };

  /* ------------------------------------------------------------ generar */
  const generar = async () => {
    if (generando) return;
    if (estado.modo === "hablar") return generarHablado();
    if (!estado.prompt.trim()) {
      setAviso({ tipo: "ambar", texto: "Escribí un prompt antes de generar." });
      return;
    }
    const usaImagenDeReferencia = estado.modo === "editar" || (estado.modo === "video" && estado.modoVideo === "imagen");
    if (usaImagenDeReferencia && !archivos.length) {
      setAviso({ tipo: "ambar", texto: "Subí al menos una imagen de referencia." });
      return;
    }

    // Los modelos de video cuestan entre 10 y 50 veces más que uno de imagen: se pide
    // confirmación antes de dispararlo para que no salga por accidente.
    if (estado.modo === "video") {
      const confirmado = window.confirm(
        `Vas a generar un video con ${entradaKieActual.nombre} (~${entradaKieActual.creditos} créditos estimados). ¿Continuar?`
      );
      if (!confirmado) return;
    }

    setAviso(null);
    setGenerando(true);
    setPendientes(estado.cantidad);

    try {
      let respuesta;
      if (usaImagenDeReferencia) {
        const forma = new FormData();
        forma.append("prompt", estado.prompt);
        forma.append("modelo", estado.modelo);
        forma.append("calidad", estado.calidad);
        forma.append("tamano", estado.tamano);
        forma.append("formato", estado.formato);
        forma.append("cantidad", String(estado.cantidad));
        if (estado.modo === "video") {
          forma.append("duracion", String(estado.duracion));
          forma.append("aspectoVideo", estado.aspectoVideo);
          forma.append("resolucion", estado.resolucion);
          forma.append("sonido", String(estado.sonido));
        }
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
        setAviso({ tipo: "error", texto: datos.error || "El proveedor rechazó el pedido." });
        return;
      }

      if (datos.proveedor === "kie") {
        setPendientes(1); // cada tarea de Kie produce una sola imagen (o video)
        await pollearTareaKie(datos.taskId, entradaKieActual.tipo);
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
      const datos = await r.json().catch(() => ({}));
      setAviso({ tipo: "error", texto: datos.error || "No se pudo borrar la imagen." });
    }
  };

  const reusar = (imagen) => {
    // Un audio de la galería se reusa como audio del paso 2 de "Hablar".
    if (imagen.tipo === "audio") {
      const enHablar = buscarModeloKie(estado.modelo)?.hablar;
      set({ modo: "hablar", modelo: enHablar ? estado.modelo : MODELOS_KIE.find((m) => m.hablar).id });
      setHablar((h) => ({ ...h, audio: entradaDesdeFicha(imagen), fuenteAudio: "archivo" }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Imágenes viejas de OpenAI tienen en `modelo` un id que ya no existe en el
    // registro (ej. "gpt-image-1-mini"): si no es un modelo de Kie válido, se reusa
    // el prompt y el tamaño nomás, sin tocar el modelo elegido.
    const cambios = { prompt: imagen.prompt, tamano: imagen.tamano };
    if (buscarModeloKie(imagen.modelo)) cambios.modelo = imagen.modelo;
    set(cambios);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("prompt")?.focus();
  };

  const mover = useCallback(
    (paso) => setVisor((i) => (historial.length ? (i + paso + historial.length) % historial.length : -1)),
    [historial.length]
  );

  /* -------------------------------------------------------------- vista */
  return (
    <div className="min-h-screen w-full max-w-full sm:pl-[50px] lg:pl-[70px]">
      {/* franja de estado, arriba de todo */}
      <div className="sticky top-0 z-50 border-b-[3px] border-tinta bg-amarillo px-4 py-2 sm:-ml-[50px] sm:pl-[56px] lg:-ml-[70px] lg:pl-[76px]">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
          <span className={hayKey ? "text-tinta" : "text-rojo"}>●</span>{" "}
          {hayKey ? "Conectado a Kie AI" : "Sin API key configurada"}
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
          creditosGastados={creditosKie}
          presupuesto={presupuesto}
          onPresupuesto={setPresupuesto}
          saldoKie={saldoKie}
        />
      </header>

      <main className="grid w-full max-w-full grid-cols-1 items-start lg:grid-cols-[368px_minmax(0,1fr)]">
        <section className="min-w-0 border-b-[3px] border-tinta px-4 py-6 sm:px-6 lg:sticky lg:top-[46px] lg:border-b-0 lg:border-r-[3px] lg:pb-16">
          <Controles
            estado={estado}
            set={set}
            archivos={archivos}
            setArchivos={setArchivos}
            onGenerar={generar}
            generando={generando}
            costo={costoTanda}
            panelHablar={
              <Hablar
                estado={estado}
                set={set}
                hablar={hablar}
                setHablar={setHablar}
                historial={historial}
                onGenerar={generar}
                generando={generando}
                onGenerarVoz={generarVoz}
                generandoVoz={generandoVoz}
                costo={costoTanda}
              />
            }
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
              {aviso.accion && (
                <button onClick={aviso.accion.onClick} className="boton shrink-0 px-3 py-1.5">
                  {aviso.accion.etiqueta}
                </button>
              )}
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

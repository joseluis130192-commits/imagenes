"use client";

import { useEffect, useState } from "react";
import { reloj } from "@/lib/reemplazar";

/** Tiempo transcurrido mientras Kie trabaja, para que una espera de minutos no parezca colgada. */
export default function Transcurrido({ desde, className = "" }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={className}>{reloj(ahora - desde)}</span>;
}

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL.replace(/\/+$/, ""), env.SUPABASE_SERVICE_ROLE_KEY);

const { data: archivos } = await supabase.storage.from("imagenes").list("", { limit: 1000 });
const { data: filas } = await supabase.from("imagenes").select("archivo");
const registrados = new Set((filas || []).map((f) => f.archivo));

const huerfanos = archivos.filter((a) => !registrados.has(a.name)).map((a) => a.name);
console.log(`${archivos.length} archivos, ${huerfanos.length} sin fila en la tabla`);

if (huerfanos.length) {
  const { error } = await supabase.storage.from("imagenes").remove(huerfanos);
  console.log(error ? "Falló: " + error.message : `Borrados ${huerfanos.length}`);
}
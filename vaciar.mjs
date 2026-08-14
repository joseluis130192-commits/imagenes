import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL.replace(/\/+$/, ""), env.SUPABASE_SERVICE_ROLE_KEY);

const { data: archivos, error } = await supabase.storage.from("imagenes").list("", { limit: 1000 });
if (error) { console.log("Error al listar:", error.message); process.exit(1); }

console.log(`${archivos.length} archivos en el bucket`);
if (archivos.length) {
  const { error: e } = await supabase.storage.from("imagenes").remove(archivos.map((a) => a.name));
  console.log(e ? "Falló: " + e.message : "Bucket vacío");
}
await supabase.from("imagenes").delete().neq("id", "");
console.log("Tabla vacía");
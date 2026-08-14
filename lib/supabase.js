import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const LLAVE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export const supabase = createClient(URL_SUPABASE, LLAVE, {
  auth: { persistSession: false },
});
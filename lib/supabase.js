import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key: solo para el servidor (API routes).
 * Nunca lo importes desde un componente "use client", esa key salta la RLS.
 */
// Fallback para que el build no reviente si todavía no están las env vars puestas
// (createClient valida la URL al construirse); en runtime real, sin las variables
// bien puestas cualquier llamada a Supabase va a fallar con un error de red o de auth.
export const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
  { auth: { persistSession: false } }
);

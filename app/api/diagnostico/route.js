import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Ruta temporal para diagnosticar el "fetch failed" al subir a Supabase.
 * No expone ningún valor secreto: solo booleanos, el host de la URL y nombres de buckets.
 * Borrar este archivo una vez resuelto el problema.
 */
export async function GET() {
  const variables = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
  };

  let urlSupabase;
  try {
    urlSupabase = { host: new URL(process.env.SUPABASE_URL).host };
  } catch (err) {
    urlSupabase = { error: `SUPABASE_URL inválida: ${err.message}` };
  }

  let buckets;
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    buckets = { nombres: data.map((b) => b.name) };
  } catch (err) {
    buckets = {
      error: err?.message || String(err),
      cause: {
        code: err?.cause?.code ?? null,
        message: err?.cause?.message ?? null,
        errno: err?.cause?.errno ?? null,
      },
    };
  }

  return Response.json({ variables, urlSupabase, buckets });
}

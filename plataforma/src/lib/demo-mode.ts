/** Local preview without Supabase Auth. Set VITE_DEMO_MODE=false to use real Auth. */
export function isDemoMode() {
  const v =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEMO_MODE) ||
    (typeof process !== "undefined" ? process.env.VITE_DEMO_MODE : undefined);
  if (v === "false" || v === "0") return false;
  // Default ON while we preview UI; flip off when linking real Supabase Auth.
  return true;
}

/**
 * Clave del enlace n8n ↔ plataforma.
 * En el navegador solo usamos VITE_ENLACE_API_KEY (pública) o el fallback de demo.
 * En servidor preferimos ENLACE_API_KEY.
 *
 * Importante Netlify: no marques ENLACE_API_KEY como secret si su valor es el
 * mismo string que el fallback de demo (aparece en el JS del cliente y el build falla).
 * O configura SECRETS_SCAN_OMIT_KEYS=ENLACE_API_KEY en netlify.toml.
 */
export function enlaceApiKey() {
  const viteKey =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_ENLACE_API_KEY
      ? String(import.meta.env.VITE_ENLACE_API_KEY)
      : "";
  if (viteKey) return viteKey;

  // Solo en SSR / Functions (no embeber ENLACE_API_KEY en el bundle del browser)
  if (typeof window === "undefined") {
    const serverKey = typeof process !== "undefined" ? process.env.ENLACE_API_KEY : "";
    if (serverKey) return String(serverKey);
  }

  return isDemoMode() ? "porcicola-enlace-demo" : "";
}

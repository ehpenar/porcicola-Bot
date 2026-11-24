/** Local preview without Supabase Auth. Set VITE_DEMO_MODE=false to use real Auth. */
export function isDemoMode() {
  const v =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEMO_MODE) ||
    (typeof process !== "undefined" ? process.env.VITE_DEMO_MODE : undefined);
  if (v === "false" || v === "0") return false;
  // Default ON while we preview UI; flip off when linking real Supabase Auth.
  return true;
}

/** Secreto que n8n envía en X-Enlace-Secret o Authorization: Bearer. */
export function enlaceApiKey() {
  const fromEnv =
    (typeof process !== "undefined" && process.env.ENLACE_API_KEY) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_ENLACE_API_KEY) ||
    "";
  if (fromEnv) return String(fromEnv);
  return isDemoMode() ? "porcicola-enlace-demo" : "";
}

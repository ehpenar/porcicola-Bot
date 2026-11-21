/** Local preview without Supabase Auth. Set VITE_DEMO_MODE=false to use real Auth. */
export function isDemoMode() {
  const v = import.meta.env.VITE_DEMO_MODE;
  if (v === "false" || v === "0") return false;
  // Default ON while we preview UI; flip off when linking real Supabase Auth.
  return v !== "false";
}

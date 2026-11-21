import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoMeFromAuth,
  getDemoAuth,
  getDemoConfigPago,
  getDemoPedidoDetail,
  listDemoComprobantes,
  listDemoPedidos,
  listDemoUsers,
} from "@/lib/demo-store";
import type { AppRole, Comprobante, Evento, Pedido, PedidoLinea, PedidoStatus } from "./pedidos";

export type Me = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  active: boolean;
};

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  staleTime: 60_000,
  queryFn: async (): Promise<Me | null> => {
    if (isDemoMode()) {
      const auth = getDemoAuth();
      return auth ? demoMeFromAuth(auth) : null;
    }
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("full_name, active").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      userId: user.id,
      email: user.email ?? "",
      fullName: profileRes.data?.full_name || user.email || "",
      role: roleRes.data?.role ?? null,
      active: profileRes.data?.active ?? false,
    };
  },
});

/** Route guard: only the listed roles (general always allowed) may enter. */
export async function requireRole(queryClient: QueryClient, allowed: AppRole[]) {
  const me = await queryClient.ensureQueryData(meQueryOptions);
  if (!me) throw redirect({ to: "/login" });
  if (!me.role || !me.active) throw redirect({ to: "/unauthorized" });
  if (me.role !== "general" && !allowed.includes(me.role)) throw redirect({ to: "/unauthorized" });
  return me;
}

export function pedidosQueryOptions(statuses: PedidoStatus[] | "all") {
  const key = statuses === "all" ? "all" : [...statuses].sort().join(",");
  return queryOptions({
    queryKey: ["pedidos", key],
    queryFn: async (): Promise<Pedido[]> => {
      if (isDemoMode()) return listDemoPedidos(statuses);
      let q = supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(1000);
      if (statuses !== "all") q = q.in("status", statuses);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type PedidoDetail = {
  pedido: Pedido;
  lineas: PedidoLinea[];
  comprobantes: Comprobante[];
  eventos: Evento[];
};

export function pedidoQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["pedido", id],
    queryFn: async (): Promise<PedidoDetail | null> => {
      if (isDemoMode()) return getDemoPedidoDetail(id);
      const { data: pedido, error } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!pedido) return null;
      const [lineas, comprobantes, eventos] = await Promise.all([
        supabase.from("pedido_lineas").select("*").eq("pedido_id", id).order("orden"),
        supabase.from("pedido_comprobantes").select("*").eq("pedido_id", id).order("recibido_at", { ascending: false }),
        supabase.from("pedido_eventos").select("*").eq("pedido_id", id).order("created_at", { ascending: true }),
      ]);
      if (lineas.error) throw lineas.error;
      if (eventos.error) throw eventos.error;
      return {
        pedido,
        lineas: lineas.data ?? [],
        comprobantes: comprobantes.data ?? [],
        eventos: eventos.data ?? [],
      };
    },
  });
}

export const comprobantesStatsQueryOptions = queryOptions({
  queryKey: ["pedidos", "comprobantes-stats"],
  queryFn: async () => {
    if (isDemoMode()) return listDemoComprobantes();
    const { data, error } = await supabase.from("pedido_comprobantes").select("resultado, recibido_at").limit(5000);
    if (error) throw error;
    return data ?? [];
  },
});

export const configPagoQueryOptions = queryOptions({
  queryKey: ["config-pago"],
  queryFn: async () => {
    if (isDemoMode()) return getDemoConfigPago();
    const { data, error } = await supabase.from("config_pago").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  role: AppRole | null;
};

export const usersQueryOptions = queryOptions({
  queryKey: ["users"],
  queryFn: async (): Promise<UserRow[]> => {
    if (isDemoMode()) return listDemoUsers();
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profiles.error) throw profiles.error;
    const roleMap = new Map((roles.data ?? []).map((r) => [r.user_id, r.role]));
    return (profiles.data ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
  },
});

export async function getSignedComprobanteUrl(path: string) {
  if (isDemoMode()) return path;
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

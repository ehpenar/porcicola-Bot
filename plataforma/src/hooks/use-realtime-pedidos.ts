import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/demo-mode";

/** Keeps every queue and detail view live when any pedido changes. */
export function useRealtimePedidos() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isDemoMode()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        void queryClient.invalidateQueries({ queryKey: ["pedido"] });
      }, 300);
    };
    const channel = supabase
      .channel(`pedidos-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_eventos" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

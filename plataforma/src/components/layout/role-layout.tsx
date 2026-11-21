import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useRealtimePedidos } from "@/hooks/use-realtime-pedidos";
import type { Me } from "@/lib/queries";

/** Shell + live invalidation for every authenticated role view. */
export function RoleLayout({ me, children }: { me: Me; children: ReactNode }) {
  useRealtimePedidos();
  return <AppShell me={me}>{children}</AppShell>;
}

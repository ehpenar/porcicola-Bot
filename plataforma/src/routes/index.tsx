import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROLE_HOME } from "@/lib/pedidos";
import { meQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me) throw redirect({ to: "/login" });
    if (!me.role || !me.active) throw redirect({ to: "/unauthorized" });
    throw redirect({ to: ROLE_HOME[me.role] });
  },
  component: () => null,
});

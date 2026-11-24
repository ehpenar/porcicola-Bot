import { createFileRoute } from "@tanstack/react-router";
import { assertEnlaceAuth } from "@/lib/enlace/crear-pedido";
import { getServerDemoPedidoDetail } from "@/lib/enlace/server-demo-store";
import { isDemoMode } from "@/lib/demo-mode";

export const Route = createFileRoute("/api/enlace/pedidos/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          assertEnlaceAuth(request);
        } catch (e) {
          if (e instanceof Response) return e;
          throw e;
        }
        if (!isDemoMode()) {
          return Response.json(
            { ok: false, error: "En producción consulta el pedido desde la UI o Supabase" },
            { status: 404 },
          );
        }
        const detail = await getServerDemoPedidoDetail(params.id);
        if (!detail) {
          return Response.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
        }
        return Response.json({ ok: true, ...detail });
      },
    },
  },
});

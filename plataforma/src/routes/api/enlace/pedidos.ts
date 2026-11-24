import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { assertEnlaceAuth, crearPedidoDesdeEnlace } from "@/lib/enlace/crear-pedido";
import { normalizeEnlaceBody } from "@/lib/enlace/schema";
import { listServerDemoPedidos } from "@/lib/enlace/server-demo-store";
import { isDemoMode } from "@/lib/demo-mode";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization, x-enlace-secret",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
}

export const Route = createFileRoute("/api/enlace/pedidos")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type, authorization, x-enlace-secret",
            "access-control-allow-methods": "GET, POST, OPTIONS",
          },
        }),

      /** Salud + listado (demo: pedidos creados vía enlace en disco). */
      GET: async ({ request }) => {
        try {
          assertEnlaceAuth(request);
        } catch (e) {
          if (e instanceof Response) return e;
          throw e;
        }
        if (isDemoMode()) {
          return json({ ok: true, mode: "demo", pedidos: listServerDemoPedidos() });
        }
        return json({
          ok: true,
          mode: "supabase",
          message: "POST un pedido confirmado del bot. El listado vive en la UI /comercial.",
        });
      },

      /** n8n → plataforma: crea pedido en estado capturado. */
      POST: async ({ request }) => {
        try {
          assertEnlaceAuth(request);
        } catch (e) {
          if (e instanceof Response) return e;
          throw e;
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "JSON inválido" }, 400);
        }

        try {
          const body = normalizeEnlaceBody(raw);
          if (body.estado && body.estado.toLowerCase() !== "confirmado") {
            return json(
              {
                ok: false,
                error: `Solo se aceptan pedidos con estado "confirmado" (recibido: "${body.estado}")`,
              },
              422,
            );
          }
          const result = await crearPedidoDesdeEnlace(body);
          return json(
            {
              ok: true,
              pedido_id: result.pedido.id,
              codigo: result.pedido.codigo,
              status: result.pedido.status,
              monto_estimado: result.pedido.monto_estimado,
              lineas: result.lineas.length,
            },
            201,
          );
        } catch (e) {
          if (e instanceof ZodError) {
            return json(
              {
                ok: false,
                error: "Payload inválido",
                details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
              },
              400,
            );
          }
          const message = e instanceof Error ? e.message : "Error al crear el pedido";
          console.error("[enlace/pedidos]", message, e);
          return json({ ok: false, error: message }, 500);
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { enviarAvisoPagoWebhook } from "@/lib/client-webhook.server";
import type { Pedido } from "@/lib/pedidos";

const bodySchema = z.object({
  pedido: z.object({
    id: z.string(),
    codigo: z.string(),
    cliente_nombre: z.string(),
    cliente_telefono: z.string().nullable().optional(),
    cliente_chat_id: z.string().nullable().optional(),
    monto_estimado: z.number().optional(),
  }),
});

export const Route = createFileRoute("/api/enlace/aviso-pago")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type",
            "access-control-allow-methods": "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Payload inválido", details: parsed.error.issues }, { status: 400 });
        }
        try {
          const pedido = {
            ...parsed.data.pedido,
            monto_estimado: parsed.data.pedido.monto_estimado ?? 0,
          } as Pedido;
          const sent = await enviarAvisoPagoWebhook(pedido);
          return Response.json({ ok: true, enviado: true, preview: sent });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Error webhook";
          console.error("[aviso-pago]", message);
          return Response.json({ ok: false, error: message }, { status: 502 });
        }
      },
    },
  },
});

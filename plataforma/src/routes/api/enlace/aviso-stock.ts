import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { StockLineaAjuste } from "@/lib/stock";
import { enviarAvisoStockWebhook } from "@/lib/stock-webhook.server";
import type { Pedido } from "@/lib/pedidos";

const bodySchema = z.object({
  pedido: z.object({
    id: z.string(),
    codigo: z.string(),
    cliente_nombre: z.string(),
    cliente_telefono: z.string().nullable().optional(),
    cliente_chat_id: z.string().nullable().optional(),
  }),
  ajustes: z.array(
    z.object({
      linea_id: z.string(),
      codigo_plu: z.string(),
      nombre: z.string(),
      cantidad_pedida: z.number(),
      unidad: z.enum(["KG", "UND"]),
      estado: z.enum(["ok", "no_disponible", "cantidad_menor"]),
      cantidad_disponible: z.number(),
    }),
  ),
  mensaje: z.string().min(1),
});

export const Route = createFileRoute("/api/enlace/aviso-stock")({
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
          const pedido = parsed.data.pedido as Pedido;
          const ajustes = parsed.data.ajustes as StockLineaAjuste[];
          const sent = await enviarAvisoStockWebhook({
            pedido,
            ajustes,
            mensaje: parsed.data.mensaje,
          });
          return Response.json({ ok: true, enviado: true, preview: sent });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Error webhook";
          console.error("[aviso-stock]", message);
          return Response.json({ ok: false, error: message }, { status: 502 });
        }
      },
    },
  },
});

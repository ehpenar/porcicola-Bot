import type { Pedido, PedidoLinea } from "@/lib/pedidos";
import { formatCantidad } from "@/lib/pedidos";

export type StockLineaEstado = "ok" | "no_disponible" | "cantidad_menor";

export type StockLineaAjuste = {
  linea_id: string;
  codigo_plu: string;
  nombre: string;
  cantidad_pedida: number;
  unidad: PedidoLinea["unidad"];
  estado: StockLineaEstado;
  /** Cantidad que sí hay (obligatoria si estado = cantidad_menor; 0 si no_disponible). */
  cantidad_disponible: number;
};

export function buildMensajeStockCliente(pedido: Pedido, ajustes: StockLineaAjuste[]): string {
  const problemas = ajustes.filter((a) => a.estado !== "ok");
  const nombre = pedido.cliente_nombre?.split(" ")[0] || "cliente";
  if (problemas.length === 0) {
    return `Hola ${nombre}, revisamos tu pedido ${pedido.codigo}: todos los productos están disponibles. Pronto te enviaremos las instrucciones de pago.`;
  }
  const partes = problemas.map((a) => {
    if (a.estado === "no_disponible") {
      return `• ${a.nombre} (${a.codigo_plu}): no tenemos disponible`;
    }
    return `• ${a.nombre} (${a.codigo_plu}): pediste ${formatCantidad(a.cantidad_pedida, a.unidad)} y solo hay ${formatCantidad(a.cantidad_disponible, a.unidad)}`;
  });
  return `Hola ${nombre}, respecto a tu pedido ${pedido.codigo}, encontramos estos cambios de disponibilidad:\n\n${partes.join("\n")}\n\nContable te contactará para confirmar el pedido ajustado y el pago.`;
}

export function buildNovedadesStock(ajustes: StockLineaAjuste[]): string {
  const problemas = ajustes.filter((a) => a.estado !== "ok");
  if (problemas.length === 0) return "Stock OK: todos los productos disponibles.";
  return problemas
    .map((a) =>
      a.estado === "no_disponible"
        ? `${a.nombre}: NO disponible`
        : `${a.nombre}: solo ${formatCantidad(a.cantidad_disponible, a.unidad)} de ${formatCantidad(a.cantidad_pedida, a.unidad)}`,
    )
    .join(" · ");
}

export function stockWebhookUrl() {
  return (
    (typeof process !== "undefined" && process.env.STOCK_WEBHOOK_URL) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_STOCK_WEBHOOK_URL) ||
    "https://ehpenar.app.n8n.cloud/webhook-test/b4d0784c-8649-4c78-bc0d-285b2476296e"
  );
}

export async function enviarAvisoStockWebhook(payload: {
  pedido: Pedido;
  ajustes: StockLineaAjuste[];
  mensaje: string;
}) {
  const url = stockWebhookUrl();
  const body = {
    tipo: "stock_verificado",
    pedido_id: payload.pedido.id,
    codigo: payload.pedido.codigo,
    chatId: payload.pedido.cliente_chat_id,
    cliente_nombre: payload.pedido.cliente_nombre,
    cliente_telefono: payload.pedido.cliente_telefono,
    mensaje: payload.mensaje,
    todo_disponible: payload.ajustes.every((a) => a.estado === "ok"),
    ajustes: payload.ajustes,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook stock falló (${res.status}): ${text.slice(0, 200)}`);
  }
  return body;
}

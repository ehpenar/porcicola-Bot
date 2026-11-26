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

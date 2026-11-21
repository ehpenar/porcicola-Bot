import type { Pedido, PedidoStatus } from "./pedidos";
import { productionDurationMs } from "./pedidos";

function sameLocalDay(iso: string | null, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function diff(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return new Date(b).getTime() - new Date(a).getTime();
}

export type Kpis = {
  capturadosHoy: number;
  porVerificar: number;
  esperandoPago: number;
  enProduccion: number;
  archivadosHoy: number;
  slaVerificacionMs: number | null;
  slaPagoMs: number | null;
  slaProduccionMs: number | null;
  pctComprobantesRechazados: number | null;
};

export function computeKpis(
  pedidos: Pedido[],
  comprobantes: { resultado: "pendiente" | "aceptado" | "rechazado" }[],
  now: Date = new Date(),
): Kpis {
  const count = (statuses: PedidoStatus[]) => pedidos.filter((p) => statuses.includes(p.status)).length;
  const resolved = comprobantes.filter((c) => c.resultado !== "pendiente");
  const rejected = resolved.filter((c) => c.resultado === "rechazado").length;
  return {
    capturadosHoy: pedidos.filter((p) => sameLocalDay(p.created_at, now)).length,
    porVerificar: count(["capturado", "en_correccion"]),
    esperandoPago: count(["verificado_comercial", "pago_solicitado", "comprobante_recibido"]),
    enProduccion: count(["liberado_produccion"]),
    archivadosHoy: pedidos.filter((p) => p.status === "archivado" && sameLocalDay(p.archived_at, now)).length,
    slaVerificacionMs: avg(pedidos.map((p) => diff(p.created_at, p.verified_at)).filter((x): x is number => x != null)),
    slaPagoMs: avg(
      pedidos.map((p) => diff(p.payment_requested_at, p.proof_received_at)).filter((x): x is number => x != null && x >= 0),
    ),
    slaProduccionMs: avg(pedidos.map((p) => productionDurationMs(p)).filter((x): x is number => x != null)),
    pctComprobantesRechazados: resolved.length ? (rejected / resolved.length) * 100 : null,
  };
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });

export function pedidosPorDia(pedidos: Pedido[], days = 14, now: Date = new Date()) {
  const rows: { key: string; dia: string; pedidos: number; produccionMin: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    rows.push({ key: dayKey(d), dia: dayLabel.format(d), pedidos: 0, produccionMin: null });
  }
  const index = new Map(rows.map((r, i) => [r.key, i]));
  const prodByDay = new Map<string, number[]>();
  for (const p of pedidos) {
    const i = index.get(dayKey(new Date(p.created_at)));
    if (i != null) rows[i]!.pedidos += 1;
    const dur = productionDurationMs(p);
    if (dur != null && p.prep_done_at) {
      const k = dayKey(new Date(p.prep_done_at));
      if (index.has(k)) prodByDay.set(k, [...(prodByDay.get(k) ?? []), dur]);
    }
  }
  for (const r of rows) {
    const list = prodByDay.get(r.key);
    if (list?.length) r.produccionMin = Math.round(list.reduce((a, b) => a + b, 0) / list.length / 60000);
  }
  return rows;
}

export function distribucionPorStatus(pedidos: Pedido[]) {
  const map = new Map<PedidoStatus, number>();
  for (const p of pedidos) map.set(p.status, (map.get(p.status) ?? 0) + 1);
  return [...map.entries()].map(([status, total]) => ({ status, total })).sort((a, b) => b.total - a.total);
}

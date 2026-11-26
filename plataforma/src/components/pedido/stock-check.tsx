import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackageX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demo-mode";
import { demoVerificarStock } from "@/lib/demo-store";
import { errorMessage, formatCantidad, type AppRole } from "@/lib/pedidos";
import { pedidoQueryOptions, type PedidoDetail } from "@/lib/queries";
import {
  buildMensajeStockCliente,
  buildNovedadesStock,
  type StockLineaAjuste,
  type StockLineaEstado,
} from "@/lib/stock";
import { cn } from "@/lib/utils";

type RowState = {
  linea_id: string;
  estado: StockLineaEstado;
  cantidad_disponible: string;
};

export function StockCheckPanel({ detail, role }: { detail: PedidoDetail; role: AppRole | null }) {
  const { pedido, lineas } = detail;
  const canEdit =
    (role === "carnicero" || role === "general") && pedido.status === "verificado_comercial";
  const queryClient = useQueryClient();
  const key = pedidoQueryOptions(pedido.id).queryKey;

  const [rows, setRows] = useState<RowState[]>(() =>
    lineas.map((l) => ({
      linea_id: l.id,
      estado: "ok" as StockLineaEstado,
      cantidad_disponible: String(l.cantidad),
    })),
  );

  const ajustes: StockLineaAjuste[] = useMemo(
    () =>
      lineas.map((l) => {
        const row = rows.find((r) => r.linea_id === l.id)!;
        const qty = Number(row.cantidad_disponible);
        return {
          linea_id: l.id,
          codigo_plu: l.codigo_plu,
          nombre: l.nombre,
          cantidad_pedida: l.cantidad,
          unidad: l.unidad,
          estado: row.estado,
          cantidad_disponible:
            row.estado === "no_disponible" ? 0 : row.estado === "ok" ? l.cantidad : qty,
        };
      }),
    [lineas, rows],
  );

  const mensajePreview = buildMensajeStockCliente(pedido, ajustes);
  const novedades = buildNovedadesStock(ajustes);

  const mutation = useMutation({
    mutationFn: async () => {
      for (const a of ajustes) {
        if (a.estado === "cantidad_menor") {
          if (!(a.cantidad_disponible > 0 && a.cantidad_disponible < a.cantidad_pedida)) {
            throw new Error(`Indica una cantidad menor a la pedida para ${a.nombre}`);
          }
        }
      }
      if (!isDemoMode()) {
        throw new Error("Verificación de stock en modo Supabase pendiente de migración de enum");
      }
      const updated = demoVerificarStock(
        pedido.id,
        ajustes.map((a) => ({
          linea_id: a.linea_id,
          estado: a.estado,
          cantidad_disponible: a.cantidad_disponible,
        })),
        novedades,
      );
      // Aviso al cliente vía webhook n8n (servidor → evita CORS)
      const wh = await fetch("/api/enlace/aviso-stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pedido: {
            id: pedido.id,
            codigo: pedido.codigo,
            cliente_nombre: pedido.cliente_nombre,
            cliente_telefono: pedido.cliente_telefono,
            cliente_chat_id: pedido.cliente_chat_id,
          },
          ajustes,
          mensaje: mensajePreview,
        }),
      });
      const whJson = (await wh.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!wh.ok || !whJson.ok) {
        toast.warning(whJson.error || "Stock guardado, pero el aviso al cliente (webhook) falló");
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Stock verificado. Pedido enviado a Contable y aviso al cliente.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canEdit && pedido.status !== "stock_verificado" && !pedido.novedades_carnicero) return null;

  if (!canEdit) {
    if (!pedido.novedades_carnicero && !lineas.some((l) => l.cantidad_real != null)) return null;
    return (
      <div className="rounded-lg border border-status-verificado/30 bg-status-verificado/5 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-status-verificado" />
          Disponibilidad (carnicero)
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">{pedido.novedades_carnicero || "—"}</p>
        <ul className="space-y-1 text-sm">
          {lineas.map((l) => {
            const real = l.cantidad_real;
            let label = "OK";
            let tone = "text-success";
            if (real == null) label = "Sin dato";
            else if (real === 0) {
              label = "No disponible";
              tone = "text-destructive";
            } else if (real < l.cantidad) {
              label = `Solo ${formatCantidad(real, l.unidad)}`;
              tone = "text-amber-700";
            }
            return (
              <li key={l.id} className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                <span>
                  {l.nombre}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({formatCantidad(l.cantidad, l.unidad)})
                  </span>
                </span>
                <span className={cn("font-medium", tone)}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-status-verificado/40 bg-card p-4 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <PackageX className="size-5 text-status-verificado" />
        Verificar disponibilidad de stock
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Marca qué productos no hay o de cuáles hay menos cantidad. Al confirmar, Contable verá el pedido y se avisará al
        cliente por WhatsApp.
      </p>
      <div className="space-y-3">
        {lineas.map((l) => {
          const row = rows.find((r) => r.linea_id === l.id)!;
          return (
            <div key={l.id} className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">{l.nombre}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {l.codigo_plu} · pedido: {formatCantidad(l.cantidad, l.unidad)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ok", "Disponible"],
                    ["cantidad_menor", "Hay menos"],
                    ["no_disponible", "No hay"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={row.estado === value ? (value === "ok" ? "success" : value === "no_disponible" ? "destructive" : "default") : "outline"}
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.linea_id === l.id
                            ? {
                                ...r,
                                estado: value,
                                cantidad_disponible:
                                  value === "ok" ? String(l.cantidad) : value === "no_disponible" ? "0" : r.cantidad_disponible,
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {row.estado === "cantidad_menor" && (
                <div className="mt-3 max-w-[200px]">
                  <Label htmlFor={`qty-${l.id}`}>Cantidad disponible</Label>
                  <Input
                    id={`qty-${l.id}`}
                    type="number"
                    inputMode="decimal"
                    step={l.unidad === "KG" ? "0.01" : "1"}
                    min="0"
                    max={l.cantidad}
                    value={row.cantidad_disponible}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.linea_id === l.id ? { ...r, cantidad_disponible: e.target.value } : r)),
                      )
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-900">
          <AlertTriangle className="size-3.5" />
          Mensaje que recibirá el cliente
        </p>
        <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{mensajePreview}</pre>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="success"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="h-10"
        >
          <CheckCircle2 />
          Confirmar disponibilidad
        </Button>
      </div>
    </div>
  );
}

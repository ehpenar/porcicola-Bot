import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Clock, FileText, MessageCircle, Pencil, Timer, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/common/page";
import { StatusBadge } from "@/components/common/status-badge";
import { LiveTimer } from "@/components/common/live-timer";
import { PedidoForm, lineasToPayload, type PedidoFormValue } from "./pedido-form";
import { isDemoMode } from "@/lib/demo-mode";
import { demoActualizarCantidadReal, demoActualizarNota, demoActualizarPedido } from "@/lib/demo-store";
import {
  ACCION_LABEL,
  ORIGEN_LABEL,
  ROLE_LABEL,
  canEditPedido,
  canSeeMoney,
  errorMessage,
  formatCOP,
  formatCantidad,
  formatDateTime,
  formatDuration,
  productionDurationMs,
  type AppRole,
  type Comprobante,
  type Evento,
  type Pedido,
  type PedidoLinea,
} from "@/lib/pedidos";
import { getSignedComprobanteUrl, type PedidoDetail } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function DetailHeader({ pedido }: { pedido: Pedido }) {
  const stamps: [string, string | null][] = [
    ["Creado", pedido.created_at],
    ["Verificado", pedido.verified_at],
    ["Pago solicitado", pedido.payment_requested_at],
    ["Comprobante", pedido.proof_received_at],
    ["Liberado", pedido.released_at],
    ["Listo", pedido.prep_done_at],
    ["Cliente notificado", pedido.client_notified_at],
    ["Archivado", pedido.archived_at],
  ];
  return (
    <div className="border-b bg-card px-4 py-4 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{pedido.codigo}</h1>
        <StatusBadge status={pedido.status} className="text-sm" />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {pedido.origen === "bot" ? <Bot className="size-3.5" /> : <UserRound className="size-3.5" />}
          {ORIGEN_LABEL[pedido.origen]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> En este estado: <LiveTimer since={pedido.status_changed_at} className="font-mono" />
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-8">
        {stamps.map(([label, v]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className={cn("font-mono text-xs", !v && "text-muted-foreground/60")}>{formatDateTime(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ProduccionPanel({ pedido }: { pedido: Pedido }) {
  if (pedido.status === "liberado_produccion") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-status-produccion/40 bg-status-produccion/5 p-4">
        <div>
          <p className="label-caps flex items-center gap-1.5 text-status-produccion">
            <span className="size-2 animate-pulse-dot rounded-full bg-status-produccion" /> En producción
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Desde {formatDateTime(pedido.released_at)}</p>
        </div>
        <LiveTimer since={pedido.released_at} mode="clock" className="font-mono text-3xl font-semibold tracking-tight text-status-produccion" />
      </div>
    );
  }
  const dur = productionDurationMs(pedido);
  if (dur == null) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-sm">
        <Timer className="size-4 text-muted-foreground" /> Duración de producción
      </p>
      <span className="font-mono text-lg font-semibold">{formatDuration(dur)}</span>
    </div>
  );
}

export function ClientePanel({ pedido, editable, onEdit }: { pedido: Pedido; editable: boolean; onEdit: () => void }) {
  const rows: [string, string | null][] = [
    ["Nombre", pedido.cliente_nombre],
    ["Teléfono", pedido.cliente_telefono],
    ["Cédula / NIT", pedido.cliente_cedula],
    ["Dirección", pedido.cliente_direccion],
    ["Barrio", pedido.cliente_barrio],
    ["Ciudad", pedido.cliente_ciudad],
    ["Chat WhatsApp", pedido.cliente_chat_id],
  ];
  return (
    <Panel
      title="Cliente"
      actions={
        editable && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil /> Editar pedido
          </Button>
        )
      }
    >
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("font-medium", !v && "font-normal text-muted-foreground/60")}>{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function CantidadRealInput({ linea }: { linea: PedidoLinea }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(linea.cantidad_real != null ? String(linea.cantidad_real) : "");
  useEffect(() => setValue(linea.cantidad_real != null ? String(linea.cantidad_real) : ""), [linea.cantidad_real]);
  const m = useMutation({
    mutationFn: async (v: number | null) => {
      if (isDemoMode()) {
        demoActualizarCantidadReal(linea.id, v);
        return;
      }
      const { error } = await supabase.rpc("actualizar_cantidad_real", { p_linea: linea.id, p_cantidad: v as number });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Cantidad real de ${linea.nombre} guardada`);
      void queryClient.invalidateQueries({ queryKey: ["pedido", linea.pedido_id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  function save() {
    const v = value.trim() === "" ? null : Number(value);
    if (v === linea.cantidad_real) return;
    if (v != null && (Number.isNaN(v) || v < 0)) return toast.error("Cantidad no válida");
    m.mutate(v);
  }
  return (
    <Input
      aria-label={`Cantidad real de ${linea.nombre}`}
      type="number"
      inputMode="decimal"
      step={linea.unidad === "KG" ? "0.01" : "1"}
      min="0"
      className="h-8 w-24 text-right font-mono"
      value={value}
      placeholder={String(linea.cantidad)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function LineasPanel({ detail, role }: { detail: PedidoDetail; role: AppRole | null }) {
  const { pedido, lineas } = detail;
  const money = canSeeMoney(role);
  const editReal = (role === "carnicero" || role === "general") && pedido.status === "liberado_produccion";
  const showReal =
    editReal ||
    lineas.some((l) => l.cantidad_real != null) ||
    pedido.status === "stock_verificado" ||
    Boolean(pedido.novedades_carnicero);
  return (
    <Panel title={`Líneas (${lineas.length})`}>
      <div className="-mx-4 -my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2">
              <th>PLU</th>
              <th>Producto</th>
              <th className="text-right">Cantidad</th>
              {showReal && <th className="text-right">Cant. real</th>}
              <th>Preparación</th>
              <th>Empaque</th>
              {money && <th className="text-right">Precio</th>}
              {money && <th className="text-right">Subtotal</th>}
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                <td className="font-mono text-xs text-muted-foreground">{l.codigo_plu}</td>
                <td className="font-medium">{l.nombre}</td>
                <td className="whitespace-nowrap text-right font-mono">{formatCantidad(l.cantidad, l.unidad)}</td>
                {showReal && (
                  <td className="text-right">
                    {editReal ? <div className="flex justify-end"><CantidadRealInput linea={l} /></div> : <span className="font-mono">{formatCantidad(l.cantidad_real, l.unidad)}</span>}
                  </td>
                )}
                <td className="text-muted-foreground">{l.preparacion || "—"}</td>
                <td className="text-muted-foreground">{l.empaque || "—"}</td>
                {money && <td className="whitespace-nowrap text-right tabular">{formatCOP(l.precio_unitario)}</td>}
                {money && <td className="whitespace-nowrap text-right tabular">{formatCOP(Math.round(l.cantidad * l.precio_unitario))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function MontosPanel({ pedido }: { pedido: Pedido }) {
  const diff = pedido.monto_pagado != null ? pedido.monto_pagado - pedido.monto_estimado : null;
  return (
    <Panel title="Montos">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Estimado</dt>
          <dd className="font-semibold tabular">{formatCOP(pedido.monto_estimado)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Pagado</dt>
          <dd className="font-semibold tabular">{formatCOP(pedido.monto_pagado)}</dd>
        </div>
        {diff != null && diff !== 0 && (
          <div className="flex justify-between border-t pt-2">
            <dt className="text-muted-foreground">Diferencia</dt>
            <dd className={cn("tabular", diff < 0 ? "text-destructive" : "text-success")}>{formatCOP(diff)}</dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

function ComprobanteItem({ c }: { c: Comprobante }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = !!c.file_path && /\.(png|jpe?g|webp|gif|heic)$/i.test(c.file_path);
  useEffect(() => {
    if (!c.file_path) return undefined;
    let alive = true;
    getSignedComprobanteUrl(c.file_path)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [c.file_path]);
  const tone =
    c.resultado === "aceptado"
      ? "bg-success/10 text-success border-success/30"
      : c.resultado === "rechazado"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-warning/15 text-warning-foreground border-warning/40";
  const label = c.resultado === "aceptado" ? "Aceptado" : c.resultado === "rechazado" ? "Rechazado" : "Pendiente";
  return (
    <li className="flex gap-3 rounded-md border p-2.5">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded border bg-muted">
        {isImage && url ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt="Vista previa del comprobante" className="size-16 object-cover" />
          </a>
        ) : (
          <FileText className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-sm border px-1.5 py-px text-[11px] font-medium", tone)}>{label}</span>
          <span className="font-mono text-xs text-muted-foreground">{formatDateTime(c.recibido_at)}</span>
        </div>
        {c.nota && <p className="mt-1 text-muted-foreground">{c.nota}</p>}
        {c.file_path ? (
          url && (
            <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline">
              Ver archivo
            </a>
          )
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Sin archivo adjunto (recibido por chat)</p>
        )}
      </div>
    </li>
  );
}

export function ComprobantesPanel({ comprobantes }: { comprobantes: Comprobante[] }) {
  return (
    <Panel title={`Comprobantes (${comprobantes.length})`}>
      {comprobantes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay comprobantes de pago.</p>
      ) : (
        <ul className="space-y-2">
          {comprobantes.map((c) => (
            <ComprobanteItem key={c.id} c={c} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function NotaEditable({
  pedidoId,
  campo,
  label,
  value,
  editable,
  placeholder,
}: {
  pedidoId: string;
  campo: "notas_contable" | "novedades_carnicero";
  label: string;
  value: string | null;
  editable: boolean;
  placeholder: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  const m = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        demoActualizarNota(pedidoId, campo, text);
        return;
      }
      const { error } = await supabase.rpc("actualizar_nota", { p_pedido: pedidoId, p_campo: campo, p_valor: text });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} guardadas`);
      void queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {editable ? (
        <div className="mt-1 space-y-2">
          <Textarea aria-label={label} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder={placeholder} />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={m.isPending || text === (value ?? "")} onClick={() => m.mutate()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn("mt-0.5 whitespace-pre-line text-sm", !value && "text-muted-foreground/60")}>{value || "—"}</p>
      )}
    </div>
  );
}

export function NotasPanel({ pedido, role }: { pedido: Pedido; role: AppRole | null }) {
  const closed = ["archivado", "rechazado", "cancelado"].includes(pedido.status);
  return (
    <Panel title="Notas y novedades">
      <div className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Notas comerciales</p>
          <p className={cn("mt-0.5 whitespace-pre-line text-sm", !pedido.notas_comercial && "text-muted-foreground/60")}>{pedido.notas_comercial || "—"}</p>
        </div>
        {role !== "carnicero" && (
          <NotaEditable
            pedidoId={pedido.id}
            campo="notas_contable"
            label="Notas contables"
            value={pedido.notas_contable}
            editable={(role === "contable" || role === "general") && !closed}
            placeholder="Observaciones de pago o facturación"
          />
        )}
        <NotaEditable
          pedidoId={pedido.id}
          campo="novedades_carnicero"
          label="Novedades del carnicero"
          value={pedido.novedades_carnicero}
          editable={(role === "carnicero" || role === "general") && pedido.status === "liberado_produccion"}
          placeholder="Faltantes de stock, diferencias de peso, cambios de corte…"
        />
      </div>
    </Panel>
  );
}

export function Timeline({ eventos }: { eventos: Evento[] }) {
  const list = [...eventos].reverse();
  return (
    <Panel title="Timeline de eventos">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin eventos.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-4">
          {list.map((e) => (
            <li key={e.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[21px] top-1 grid size-2.5 place-items-center rounded-full ring-4 ring-card",
                  e.accion === "mensaje_simulado" ? "bg-status-notificado" : e.to_status ? "bg-primary" : "bg-muted-foreground",
                )}
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium">
                  {e.accion === "mensaje_simulado" && <MessageCircle className="mr-1 inline size-3.5 text-status-notificado" />}
                  {ACCION_LABEL[e.accion] ?? e.accion}
                </p>
                {e.to_status && <StatusBadge status={e.to_status} />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{formatDateTime(e.created_at)}</span>
                {" · "}
                {e.actor_role ? ROLE_LABEL[e.actor_role] : "Sistema / bot"}
              </p>
              {e.detalle && <p className="mt-1 rounded-sm bg-muted/60 px-2 py-1 text-sm">{e.detalle}</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function EditPedidoDialog({ detail, open, onOpenChange }: { detail: PedidoDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pedido, lineas } = detail;
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (v: PedidoFormValue) => {
      if (isDemoMode()) {
        demoActualizarPedido(pedido.id, v.cliente as Record<string, string>, lineasToPayload(v.lineas), v.notas);
        return;
      }
      const { error } = await supabase.rpc("actualizar_pedido", {
        p_pedido: pedido.id,
        p_cliente: v.cliente,
        p_lineas: lineasToPayload(v.lineas),
        p_notas_comercial: v.notas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido actualizado");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["pedido", pedido.id] });
      void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {pedido.codigo}</DialogTitle>
          <DialogDescription>Corrige los datos del cliente y las líneas antes de verificar.</DialogDescription>
        </DialogHeader>
        {open && (
          <PedidoForm
            initial={{
              cliente: {
                cliente_nombre: pedido.cliente_nombre,
                cliente_telefono: pedido.cliente_telefono ?? "",
                cliente_cedula: pedido.cliente_cedula ?? "",
                cliente_direccion: pedido.cliente_direccion ?? "",
                cliente_barrio: pedido.cliente_barrio ?? "",
                cliente_ciudad: pedido.cliente_ciudad ?? "",
              },
              lineas: lineas.map((l) => ({
                codigo_plu: l.codigo_plu,
                nombre: l.nombre,
                cantidad: l.cantidad,
                unidad: l.unidad,
                preparacion: l.preparacion ?? "",
                empaque: l.empaque ?? "",
                precio_unitario: l.precio_unitario,
              })),
              notas: pedido.notas_comercial ?? "",
            }}
            submitLabel="Guardar cambios"
            submitting={m.isPending}
            onSubmit={(v) => m.mutate(v)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export { canEditPedido };

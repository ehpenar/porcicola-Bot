import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Archive, Ban, CheckCircle2, CircleDollarSign, FileUp, Lock, Send, Undo2, XCircle, PackageCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDemoMode } from "@/lib/demo-mode";
import { demoRegistrarComprobante, demoTransicionar } from "@/lib/demo-store";
import { allowedTransitions, errorMessage, formatCOP, type AppRole, type Pedido, type PedidoStatus } from "@/lib/pedidos";
import { configPagoQueryOptions, pedidoQueryOptions, type PedidoDetail } from "@/lib/queries";

type ActionDef = {
  id: string;
  label: string;
  icon: ReactNode;
  variant: ButtonProps["variant"];
  to?: PedidoStatus;
  upload?: boolean;
  note?: { label: string; required: boolean };
  monto?: boolean;
  confirm?: { title: string; description: string };
  showPaymentInfo?: boolean;
  successToast?: string;
};

const BY_ACCION: Record<string, Omit<ActionDef, "id" | "to">> = {
  verificar_pedido: {
    label: "Pedido verificado",
    icon: <CheckCircle2 />,
    variant: "default",
    successToast: "Pedido verificado. Pasa al Carnicero para confirmar stock.",
  },
  verificar_stock: {
    label: "Confirmar disponibilidad",
    icon: <PackageCheck />,
    variant: "success",
    successToast: "Stock verificado. Contable ya puede cobrar.",
  },
  rechazar_pedido: {
    label: "Rechazar",
    icon: <XCircle />,
    variant: "destructive",
    note: { label: "Motivo del rechazo", required: true },
    confirm: { title: "¿Rechazar este pedido?", description: "El pedido sale de las colas activas y queda en el histórico. Esta acción no se puede deshacer." },
  },
  enviar_a_correccion: { label: "Enviar a corrección", icon: <RotateCcw />, variant: "outline", note: { label: "¿Qué hay que corregir?", required: true } },
  regresar_a_captura: { label: "Regresar a captura", icon: <Undo2 />, variant: "outline" },
  solicitar_pago: {
    label: "Solicitar pago al cliente",
    icon: <Send />,
    variant: "default",
    showPaymentInfo: true,
    confirm: { title: "Solicitar pago al cliente", description: "Se enviará al cliente el mensaje con las instrucciones de pago (simulado)." },
    successToast: "Mensaje simulado enviado al cliente",
  },
  devolver_a_comercial: { label: "Devolver a comercial", icon: <Undo2 />, variant: "outline", note: { label: "Nota para comercial", required: true } },
  cancelar_pedido: {
    label: "Cancelar pedido",
    icon: <Ban />,
    variant: "outline",
    note: { label: "Motivo de la cancelación", required: true },
    confirm: { title: "¿Cancelar el pedido?", description: "El pedido pasa al histórico como cancelado. Esta acción no se puede deshacer." },
  },
  validar_pago_y_liberar: {
    label: "Validar pago y liberar",
    icon: <CircleDollarSign />,
    variant: "success",
    monto: true,
    note: { label: "Nota (opcional)", required: false },
    confirm: { title: "Validar pago y liberar a producción", description: "Confirma que el dinero está en la cuenta. El carnicero podrá empezar a trabajar y arranca el cronómetro." },
    successToast: "Pago validado. Pedido liberado a producción.",
  },
  rechazar_comprobante: { label: "Rechazar comprobante", icon: <XCircle />, variant: "outline", note: { label: "Motivo (se pedirá un nuevo comprobante)", required: true } },
  marcar_listo_despacho: {
    label: "Marcar listo para despacho",
    icon: <PackageCheck />,
    variant: "success",
    confirm: { title: "¿Pedido listo para despacho?", description: "Se detiene el cronómetro de producción y Contable podrá notificar al cliente." },
    successToast: "Pedido listo para despacho",
  },
  notificar_cliente_y_archivar: {
    label: "Notificar cliente y archivar",
    icon: <Archive />,
    variant: "default",
    confirm: { title: "Notificar cliente y archivar", description: "Se avisará al cliente que su pedido está listo (simulado) y el pedido quedará archivado." },
    successToast: "Mensaje simulado enviado al cliente. Pedido archivado.",
  },
  archivar: {
    label: "Archivar",
    icon: <Archive />,
    variant: "default",
    confirm: { title: "¿Archivar el pedido?", description: "El pedido pasará a Trabajos procesados." },
    successToast: "Pedido archivado",
  },
};

/** verificar_stock se hace en StockCheckPanel (listado de productos). */
const HIDDEN = new Set(["marcar_comprobante_recibido", "notificar_cliente", "verificar_stock"]);

export function actionsFor(role: AppRole | null, status: PedidoStatus): ActionDef[] {
  const list: ActionDef[] = allowedTransitions(role, status)
    .filter((t) => !HIDDEN.has(t.accion))
    .map((t) => ({ id: t.accion, to: t.to, ...BY_ACCION[t.accion]! }));
  const canUpload = role === "general" || role === "contable";
  if (canUpload && (status === "pago_solicitado" || status === "comprobante_recibido")) {
    list.unshift({
      id: "adjuntar",
      label: status === "pago_solicitado" ? "Adjuntar comprobante" : "Adjuntar otro comprobante",
      icon: <FileUp />,
      variant: status === "pago_solicitado" ? "default" : "outline",
      upload: true,
      note: { label: "Nota (opcional)", required: false },
      successToast: "Comprobante registrado",
    });
  }
  // Primary actions on the right
  const order = (a: ActionDef) => (a.variant === "default" || a.variant === "success" ? 1 : 0);
  return list.sort((a, b) => order(a) - order(b));
}

function readOnlyMessage(role: AppRole | null, status: PedidoStatus) {
  if (role === "carnicero" && status === "verificado_comercial")
    return "Usa el panel de disponibilidad arriba para marcar stock y confirmar.";
  if (role === "carnicero" && ["stock_verificado", "pago_solicitado", "comprobante_recibido"].includes(status))
    return "Solo lectura — esperando que Contable valide el pago.";
  if (role === "contable" && status === "verificado_comercial")
    return "Esperando que el Carnicero confirme disponibilidad de stock.";
  if (status === "liberado_produccion") return "En producción con el carnicero.";
  if (["archivado", "rechazado", "cancelado"].includes(status)) return "Pedido cerrado. Solo lectura.";
  return "No hay acciones disponibles para tu rol en este estado.";
}

export function ActionBar({ detail, role }: { detail: PedidoDetail; role: AppRole | null }) {
  const { pedido } = detail;
  const actions = actionsFor(role, pedido.status);
  const [active, setActive] = useState<ActionDef | null>(null);
  const queryClient = useQueryClient();
  const key = pedidoQueryOptions(pedido.id).queryKey;

  const mutation = useMutation({
    mutationFn: async (input: { action: ActionDef; nota: string; monto: number | null; file: File | null }) => {
      const { action, nota, monto, file } = input;
      if (action.upload) {
        if (isDemoMode()) {
          demoRegistrarComprobante(pedido.id, nota);
          return;
        }
        let path: string | null = null;
        if (file) {
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
          path = `${pedido.id}/${Date.now()}-${safe}`;
          const up = await supabase.storage.from("comprobantes").upload(path, file, { contentType: file.type });
          if (up.error) throw up.error;
        }
        const { error } = await supabase.rpc("registrar_comprobante", { p_pedido: pedido.id, p_file_path: path ?? "", p_nota: nota });
        if (error) throw error;
        return;
      }
      if (isDemoMode()) {
        demoTransicionar(pedido.id, action.to!, nota, monto, role);
        return;
      }
      const { error } = await supabase.rpc("transicionar_pedido", {
        p_pedido: pedido.id,
        p_to: action.to!,
        p_nota: nota,
        ...(monto != null ? { p_monto_pagado: monto } : {}),
      });
      if (error) throw error;
    },
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData(key);
      const nextStatus: PedidoStatus | undefined = action.upload
        ? pedido.status === "pago_solicitado"
          ? "comprobante_recibido"
          : undefined
        : action.to;
      if (prev && nextStatus) {
        const now = new Date().toISOString();
        const patch: Partial<Pedido> = { status: nextStatus, status_changed_at: now };
        if (nextStatus === "liberado_produccion") patch.released_at = now;
        if (nextStatus === "listo_despacho") patch.prep_done_at = now;
        queryClient.setQueryData(key, { ...prev, pedido: { ...prev.pedido, ...patch } });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(key, ctx.prev);
      toast.error(errorMessage(e));
    },
    onSuccess: (_d, { action }) => {
      setActive(null);
      toast.success(action.successToast ?? "Acción registrada");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  function trigger(a: ActionDef) {
    if (a.note || a.monto || a.upload || a.confirm) setActive(a);
    else mutation.mutate({ action: a, nota: "", monto: null, file: null });
  }

  return (
    <>
      {/* pr/pb extra: el badge "Powered by Netlify" tapa la esquina inferior derecha */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-14 shadow-bar backdrop-blur md:left-60 md:pb-3 md:pr-44">
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-center md:px-8">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:mr-4">
            {actions.length === 0 ? (
              <>
                <Lock className="size-3.5" /> {readOnlyMessage(role, pedido.status)}
              </>
            ) : (
              <>
                Acciones disponibles para <span className="font-mono font-semibold text-foreground">{pedido.codigo}</span>
              </>
            )}
          </p>
          {actions.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-center">
              {actions.map((a) => (
                <Button key={a.id} variant={a.variant} onClick={() => trigger(a)} disabled={mutation.isPending} className="h-10 sm:h-9">
                  {a.icon}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      <ActionDialog
        action={active}
        pedido={pedido}
        pending={mutation.isPending}
        onClose={() => setActive(null)}
        onSubmit={(v) => active && mutation.mutate({ action: active, ...v })}
      />
    </>
  );
}

function PaymentInfo() {
  const { data } = useQuery(configPagoQueryOptions);
  return (
    <div className="rounded-md border bg-muted/50 p-3 text-sm">
      <p className="label-caps mb-1">Instrucciones que recibirá el cliente</p>
      <p className="whitespace-pre-line">{data?.instrucciones || "Sin instrucciones configuradas."}</p>
      {data?.qr_url && <img src={data.qr_url} alt="Código QR de pago" className="mt-2 size-32 rounded border object-contain" />}
    </div>
  );
}

function ActionDialog({
  action,
  pedido,
  pending,
  onClose,
  onSubmit,
}: {
  action: ActionDef | null;
  pedido: Pedido;
  pending: boolean;
  onClose: () => void;
  onSubmit: (v: { nota: string; monto: number | null; file: File | null }) => void;
}) {
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {action && <ActionDialogBody key={action.id} action={action} pedido={pedido} pending={pending} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function ActionDialogBody({
  action,
  pedido,
  pending,
  onClose,
  onSubmit,
}: {
  action: ActionDef;
  pedido: Pedido;
  pending: boolean;
  onClose: () => void;
  onSubmit: (v: { nota: string; monto: number | null; file: File | null }) => void;
}) {
  const [nota, setNota] = useState("");
  const [monto, setMonto] = useState<string>(String(pedido.monto_estimado ?? ""));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (action.note?.required && !nota.trim()) return setError("Escribe una nota para continuar.");
    const montoNum = action.monto ? Number(monto) : null;
    if (action.monto && !(montoNum! > 0)) return setError("Indica el monto pagado.");
    onSubmit({ nota: nota.trim(), monto: montoNum, file });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{action.confirm?.title ?? action.label}</DialogTitle>
        <DialogDescription>
          {action.confirm?.description ?? (
            <>
              Pedido <span className="font-mono">{pedido.codigo}</span> · {pedido.cliente_nombre}
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      {action.showPaymentInfo && <PaymentInfo />}
      {action.upload && (
        <div>
          <Label htmlFor="a-file">Archivo del comprobante (imagen o PDF)</Label>
          <Input id="a-file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-muted-foreground">Opcional en el MVP: puedes registrar que llegó por WhatsApp sin adjuntar archivo.</p>
        </div>
      )}
      {action.monto && (
        <div>
          <Label htmlFor="a-monto">Monto pagado (COP)</Label>
          <Input id="a-monto" type="number" min="0" step="100" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Monto estimado del pedido: {formatCOP(pedido.monto_estimado)}</p>
        </div>
      )}
      {action.note && (
        <div>
          <Label htmlFor="a-nota">{action.note.label}</Label>
          <Textarea id="a-nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1000} />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Volver
        </Button>
        <Button type="submit" variant={action.variant === "outline" ? "default" : action.variant} disabled={pending}>
          {action.icon}
          {action.label}
        </Button>
      </DialogFooter>
    </form>
  );
}

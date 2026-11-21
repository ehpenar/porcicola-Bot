import { useNavigate } from "@tanstack/react-router";
import { Bot, ChevronRight, Inbox, UserRound } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { LiveTimer } from "./live-timer";
import { EmptyState } from "./page";
import { formatCOP, formatDateTime, formatDuration, ORIGEN_LABEL, productionDurationMs, type Pedido } from "@/lib/pedidos";
import { cn } from "@/lib/utils";

export type TimerMode = "cola" | "produccion" | "duracion" | "ninguno";

export function PedidosTable({
  pedidos,
  showMoney = true,
  timer = "cola",
  emptyTitle = "No hay pedidos aquí",
  emptyDescription,
  readOnlyHint,
}: {
  pedidos: Pedido[];
  showMoney?: boolean;
  timer?: TimerMode;
  emptyTitle?: string;
  emptyDescription?: string | undefined;
  readOnlyHint?: string | undefined;
}) {
  const navigate = useNavigate();
  if (pedidos.length === 0) {
    return <EmptyState icon={<Inbox />} title={emptyTitle} description={emptyDescription} />;
  }
  const open = (id: string) => navigate({ to: "/pedidos/$id", params: { id } });
  const timerHeader = timer === "produccion" ? "Cronómetro" : timer === "duracion" ? "Producción" : "En cola";

  const timerCell = (p: Pedido) => {
    if (timer === "produccion")
      return <LiveTimer since={p.released_at} mode="clock" className="font-mono font-medium text-status-produccion" />;
    if (timer === "duracion") return <span className="font-mono">{formatDuration(productionDurationMs(p))}</span>;
    if (timer === "cola") return <LiveTimer since={p.status_changed_at} className="font-mono" />;
    return null;
  };

  return (
    <div>
      {readOnlyHint && <p className="mb-2 text-xs text-muted-foreground">{readOnlyHint}</p>}
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-md border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left">
            <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2">
              <th>ID</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Origen</th>
              {showMoney && <th className="text-right">Monto est.</th>}
              <th>Estado</th>
              <th>Creado</th>
              {timer !== "ninguno" && <th className="text-right">{timerHeader}</th>}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr
                key={p.id}
                onClick={() => open(p.id)}
                className="cursor-pointer border-b last:border-0 hover:bg-accent/50 [&>td]:px-3 [&>td]:py-2.5"
              >
                <td className="font-mono text-xs font-semibold">{p.codigo}</td>
                <td className="max-w-56 truncate font-medium">{p.cliente_nombre}</td>
                <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{p.cliente_telefono ?? "—"}</td>
                <td className="whitespace-nowrap text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {p.origen === "bot" ? <Bot className="size-3.5" /> : <UserRound className="size-3.5" />}
                    {ORIGEN_LABEL[p.origen]}
                  </span>
                </td>
                {showMoney && <td className="whitespace-nowrap text-right tabular">{formatCOP(p.monto_estimado)}</td>}
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(p.created_at)}</td>
                {timer !== "ninguno" && <td className="whitespace-nowrap text-right text-xs">{timerCell(p)}</td>}
                <td className="text-muted-foreground">
                  <ChevronRight className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {pedidos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => open(p.id)}
              className={cn("w-full rounded-md border bg-card p-3 text-left shadow-card active:bg-accent/50")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{p.codigo}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1.5 font-medium">{p.cliente_nombre}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{p.cliente_telefono ?? "—"}</span>
                <span>{ORIGEN_LABEL[p.origen]}</span>
                {showMoney && <span className="tabular text-foreground">{formatCOP(p.monto_estimado)}</span>}
              </div>
              {timer !== "ninguno" && (
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">{timerHeader}</span>
                  {timerCell(p)}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

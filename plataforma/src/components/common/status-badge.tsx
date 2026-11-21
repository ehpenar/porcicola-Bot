import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_DOT, STATUS_LABEL, type PedidoStatus } from "@/lib/pedidos";

export function StatusBadge({ status, className }: { status: PedidoStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          STATUS_DOT[status],
          status === "liberado_produccion" && "animate-pulse-dot",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

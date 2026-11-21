import { useNow } from "@/hooks/use-now";
import { formatClock, formatDuration } from "@/lib/pedidos";

export function LiveTimer({ since, mode = "duration", className }: { since: string | null; mode?: "duration" | "clock"; className?: string }) {
  const now = useNow(mode === "clock" ? 1000 : 15000);
  if (!since) return <span className={className}>—</span>;
  if (now == null) return <span className={className}>…</span>;
  const ms = now - new Date(since).getTime();
  return <span className={className}>{mode === "clock" ? formatClock(ms) : formatDuration(ms)}</span>;
}

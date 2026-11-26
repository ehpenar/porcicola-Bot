import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, PageSkeleton } from "@/components/common/page";
import { PedidosTable } from "@/components/common/pedidos-table";
import { QueueTabs } from "@/components/common/queue-tabs";
import type { PedidoStatus } from "@/lib/pedidos";
import { pedidosQueryOptions, requireRole } from "@/lib/queries";

const COBRAR: PedidoStatus[] = ["stock_verificado"];
const PAGO: PedidoStatus[] = ["pago_solicitado", "comprobante_recibido"];
const PRODUCCION: PedidoStatus[] = ["liberado_produccion"];
const CERRAR: PedidoStatus[] = ["listo_despacho", "notificado_cliente"];
const PROCESADOS: PedidoStatus[] = ["archivado"];

export const Route = createFileRoute("/contable")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["contable"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Contable · Porcicola Ops" }] }),
  component: ContablePage,
});

function ContablePage() {
  const { me } = Route.useRouteContext();
  const [tab, setTab] = useState("cobrar");
  const all = [...COBRAR, ...PAGO, ...PRODUCCION, ...CERRAR, ...PROCESADOS] as PedidoStatus[];
  const q = useQuery(pedidosQueryOptions(all));

  const queues = useMemo(() => {
    const list = q.data ?? [];
    const filter = (statuses: PedidoStatus[]) => list.filter((p) => statuses.includes(p.status));
    return [
      {
        value: "cobrar",
        label: "Por revisar / cobrar",
        count: filter(COBRAR).length,
        hint: "Solo pedidos con stock ya confirmado por el Carnicero.",
        content: <PedidosTable pedidos={filter(COBRAR)} emptyTitle="Nada por cobrar" emptyDescription="Cuando el Carnicero confirme disponibilidad, aparecerán aquí." />,
      },
      {
        value: "pago",
        label: "Esperando / validar pago",
        count: filter(PAGO).length,
        content: <PedidosTable pedidos={filter(PAGO)} emptyTitle="Sin pagos pendientes" />,
      },
      {
        value: "prod",
        label: "En producción",
        count: filter(PRODUCCION).length,
        hint: "Cronómetro desde que liberaste el pedido al carnicero.",
        content: (
          <PedidosTable
            pedidos={filter(PRODUCCION)}
            timer="produccion"
            emptyTitle="Nadie está cortando ahora"
          />
        ),
      },
      {
        value: "cerrar",
        label: "Por cerrar",
        count: filter(CERRAR).length,
        content: <PedidosTable pedidos={filter(CERRAR)} emptyTitle="Nada por cerrar" />,
      },
      {
        value: "procesados",
        label: "Trabajos procesados",
        count: filter(PROCESADOS).length,
        content: (
          <PedidosTable
            pedidos={filter(PROCESADOS)}
            timer="duracion"
            emptyTitle="Aún no hay trabajos procesados"
          />
        ),
      },
    ];
  }, [q.data]);

  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Contable"
        description="Revisas montos, solicitas y validas el pago, y liberas la producción."
      />
      <PageBody>{q.isLoading ? <PageSkeleton /> : <QueueTabs queues={queues} value={tab} onChange={setTab} />}</PageBody>
    </RoleLayout>
  );
}

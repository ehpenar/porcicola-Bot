import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, PageSkeleton } from "@/components/common/page";
import { PedidosTable } from "@/components/common/pedidos-table";
import { QueueTabs } from "@/components/common/queue-tabs";
import type { PedidoStatus } from "@/lib/pedidos";
import { pedidosQueryOptions, requireRole } from "@/lib/queries";

const STOCK: PedidoStatus[] = ["verificado_comercial"];
const ESPERA_PAGO: PedidoStatus[] = ["stock_verificado", "pago_solicitado", "comprobante_recibido"];
const TRABAJO: PedidoStatus[] = ["liberado_produccion"];
const REALIZADOS: PedidoStatus[] = ["archivado", "listo_despacho", "notificado_cliente"];

export const Route = createFileRoute("/carnicero")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["carnicero"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Carnicero · Porcicola Ops" }] }),
  component: CarniceroPage,
});

function CarniceroPage() {
  const { me } = Route.useRouteContext();
  const [tab, setTab] = useState("stock");
  const all = [...STOCK, ...ESPERA_PAGO, ...TRABAJO, ...REALIZADOS] as PedidoStatus[];
  const q = useQuery(pedidosQueryOptions(all));

  const queues = useMemo(() => {
    const list = q.data ?? [];
    const filter = (statuses: PedidoStatus[]) => list.filter((p) => statuses.includes(p.status));
    return [
      {
        value: "stock",
        label: "Verificar stock",
        count: filter(STOCK).length,
        hint: "Tras Comercial: confirma si hay producto y cantidades.",
        content: (
          <PedidosTable
            pedidos={filter(STOCK)}
            showMoney={false}
            emptyTitle="Nada por verificar"
            emptyDescription="Cuando Comercial verifique un pedido, aparecerá aquí."
          />
        ),
      },
      {
        value: "espera",
        label: "Espera pago / liberación",
        count: filter(ESPERA_PAGO).length,
        hint: "Ya confirmaste stock; Contable cobra y libera.",
        content: (
          <PedidosTable
            pedidos={filter(ESPERA_PAGO)}
            showMoney={false}
            readOnlyHint="Puedes anticipar la carga, pero no puedes empezar a cortar."
            emptyTitle="Nada en espera de pago"
          />
        ),
      },
      {
        value: "trabajo",
        label: "Liberados / en trabajo",
        count: filter(TRABAJO).length,
        content: (
          <PedidosTable
            pedidos={filter(TRABAJO)}
            showMoney={false}
            timer="produccion"
            emptyTitle="No hay pedidos liberados"
            emptyDescription="Cuando Contable valide el pago, aparecerán aquí."
          />
        ),
      },
      {
        value: "realizados",
        label: "Trabajos realizados",
        count: filter(REALIZADOS).length,
        content: (
          <PedidosTable
            pedidos={filter(REALIZADOS)}
            showMoney={false}
            timer="duracion"
            emptyTitle="Sin trabajos realizados"
          />
        ),
      },
    ];
  }, [q.data]);

  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Carnicero"
        description="Primero confirmas stock; luego cortas solo pedidos liberados. Los precios no se muestran."
      />
      <PageBody>{q.isLoading ? <PageSkeleton /> : <QueueTabs queues={queues} value={tab} onChange={setTab} />}</PageBody>
    </RoleLayout>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, PageSkeleton } from "@/components/common/page";
import { PedidosTable } from "@/components/common/pedidos-table";
import { QueueTabs } from "@/components/common/queue-tabs";
import { CrearPedidoDemoButton, CrearPedidoManualButton } from "@/components/pedido/crear-pedido";
import type { PedidoStatus } from "@/lib/pedidos";
import { pedidosQueryOptions, requireRole } from "@/lib/queries";

const EN_PROCESO: PedidoStatus[] = [
  "verificado_comercial",
  "pago_solicitado",
  "comprobante_recibido",
  "liberado_produccion",
  "listo_despacho",
  "notificado_cliente",
];
const HISTORICO: PedidoStatus[] = ["archivado", "rechazado", "cancelado"];
const POR_VERIFICAR: PedidoStatus[] = ["capturado", "en_correccion"];

export const Route = createFileRoute("/comercial")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["comercial"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Comercial · Porcicola Ops" }] }),
  component: ComercialPage,
});

function ComercialPage() {
  const { me } = Route.useRouteContext();
  const [tab, setTab] = useState("verificar");
  const allStatuses = [...POR_VERIFICAR, ...EN_PROCESO, ...HISTORICO] as PedidoStatus[];
  const q = useQuery(pedidosQueryOptions(allStatuses));

  const queues = useMemo(() => {
    const list = q.data ?? [];
    const filter = (statuses: PedidoStatus[]) => list.filter((p) => statuses.includes(p.status));
    const verificar = filter(POR_VERIFICAR);
    const proceso = filter(EN_PROCESO);
    const historico = filter(HISTORICO);
    return [
      {
        value: "verificar",
        label: "Por verificar",
        count: verificar.length,
        content: (
          <PedidosTable
            pedidos={verificar}
            emptyTitle="No hay pedidos por verificar"
            emptyDescription="Crea un pedido demo o espera uno del bot de WhatsApp."
          />
        ),
      },
      {
        value: "proceso",
        label: "En proceso",
        count: proceso.length,
        content: <PedidosTable pedidos={proceso} emptyTitle="Nada en proceso" timer="cola" />,
      },
      {
        value: "historico",
        label: "Histórico",
        count: historico.length,
        content: <PedidosTable pedidos={historico} timer="ninguno" emptyTitle="Sin histórico aún" />,
      },
    ];
  }, [q.data]);

  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Comercial"
        description="Verifica la calidad de lo capturado. No cobras ni liberas producción."
        actions={
          <>
            <CrearPedidoDemoButton />
            <CrearPedidoManualButton />
          </>
        }
      />
      <PageBody>{q.isLoading ? <PageSkeleton /> : <QueueTabs queues={queues} value={tab} onChange={setTab} />}</PageBody>
    </RoleLayout>
  );
}

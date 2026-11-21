import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageSkeleton } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/pedido/action-bar";
import {
  ClientePanel,
  ComprobantesPanel,
  DetailHeader,
  EditPedidoDialog,
  LineasPanel,
  MontosPanel,
  NotasPanel,
  ProduccionPanel,
  Timeline,
  canEditPedido,
} from "@/components/pedido/pedido-detail";
import { canSeeMoney, ROLE_HOME } from "@/lib/pedidos";
import { pedidoQueryOptions, requireRole } from "@/lib/queries";

export const Route = createFileRoute("/pedidos/$id")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general", "comercial", "contable", "carnicero"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Pedido · Porcicola Ops" }] }),
  component: PedidoDetailPage,
});

function PedidoDetailPage() {
  const { me } = Route.useRouteContext();
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const q = useQuery(pedidoQueryOptions(id));
  const backTo = me.role ? ROLE_HOME[me.role] : "/";

  if (q.isLoading) {
    return (
      <RoleLayout me={me}>
        <PageSkeleton />
      </RoleLayout>
    );
  }

  if (!q.data) {
    return (
      <RoleLayout me={me}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
          <p className="font-medium">Pedido no encontrado</p>
          <Button asChild variant="outline">
            <Link to={backTo}>Volver</Link>
          </Button>
        </div>
      </RoleLayout>
    );
  }

  const detail = q.data;
  const { pedido } = detail;
  const editable = canEditPedido(me.role, pedido.status);
  const money = canSeeMoney(me.role);

  return (
    <RoleLayout me={me}>
      <div className="border-b bg-card px-4 py-2 md:px-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={backTo}>
            <ArrowLeft /> Volver a mis colas
          </Link>
        </Button>
      </div>
      <DetailHeader pedido={pedido} />
      <div className="space-y-4 px-4 py-5 pb-28 md:px-8">
        <ProduccionPanel pedido={pedido} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <ClientePanel pedido={pedido} editable={editable} onEdit={() => setEditOpen(true)} />
            <LineasPanel detail={detail} role={me.role} />
            <NotasPanel pedido={pedido} role={me.role} />
          </div>
          <div className="space-y-4">
            {money && <MontosPanel pedido={pedido} />}
            {money && <ComprobantesPanel comprobantes={detail.comprobantes} />}
            <Timeline eventos={detail.eventos} />
          </div>
        </div>
      </div>
      <ActionBar detail={detail} role={me.role} />
      {editable && <EditPedidoDialog detail={detail} open={editOpen} onOpenChange={setEditOpen} />}
    </RoleLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, PageSkeleton } from "@/components/common/page";
import { PedidosTable } from "@/components/common/pedidos-table";
import { CrearPedidoDemoButton } from "@/components/pedido/crear-pedido";
import { pedidosQueryOptions, requireRole } from "@/lib/queries";

export const Route = createFileRoute("/general/pedidos")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Todos los pedidos · Porcicola Ops" }] }),
  component: GeneralPedidosPage,
});

function GeneralPedidosPage() {
  const { me } = Route.useRouteContext();
  const q = useQuery(pedidosQueryOptions("all"));
  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Todos los pedidos"
        description="Vista global sin filtro de cola."
        actions={<CrearPedidoDemoButton />}
      />
      <PageBody>
        {q.isLoading ? (
          <PageSkeleton />
        ) : (
          <PedidosTable pedidos={q.data ?? []} timer="cola" emptyTitle="No hay pedidos" />
        )}
      </PageBody>
    </RoleLayout>
  );
}

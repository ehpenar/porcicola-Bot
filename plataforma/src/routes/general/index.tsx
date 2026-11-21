import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, Panel } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { CrearPedidoDemoButton } from "@/components/pedido/crear-pedido";
import { formatDuration } from "@/lib/pedidos";
import { STATUS_LABEL } from "@/lib/pedidos";
import { comprobantesStatsQueryOptions, pedidosQueryOptions, requireRole } from "@/lib/queries";
import { computeKpis, distribucionPorStatus, pedidosPorDia } from "@/lib/stats";

export const Route = createFileRoute("/general/")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Panel general · Porcicola Ops" }] }),
  component: GeneralDashboard,
});

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-card">
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GeneralDashboard() {
  const { me } = Route.useRouteContext();
  const pedidosQ = useQuery(pedidosQueryOptions("all"));
  const compsQ = useQuery(comprobantesStatsQueryOptions);
  const pedidos = pedidosQ.data ?? [];
  const kpis = computeKpis(pedidos, compsQ.data ?? []);
  const porDia = pedidosPorDia(pedidos, 14);
  const dist = distribucionPorStatus(pedidos).map((d) => ({
    ...d,
    nombre: STATUS_LABEL[d.status],
  }));

  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Panel general"
        description="Visión completa de la operación, accesos y métricas."
        actions={
          <>
            <CrearPedidoDemoButton />
            <Button asChild variant="outline">
              <Link to="/general/usuarios">Usuarios</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/general/estadisticas">Estadísticas</Link>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Capturados hoy" value={String(kpis.capturadosHoy)} />
          <StatCard label="Por verificar" value={String(kpis.porVerificar)} />
          <StatCard label="Esperando pago" value={String(kpis.esperandoPago)} />
          <StatCard label="En producción" value={String(kpis.enProduccion)} />
          <StatCard label="Archivados hoy" value={String(kpis.archivadosHoy)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="SLA verificación" value={formatDuration(kpis.slaVerificacionMs)} hint="Promedio created → verified" />
          <StatCard label="SLA pago cliente" value={formatDuration(kpis.slaPagoMs)} hint="Solicitado → comprobante" />
          <StatCard label="SLA producción" value={formatDuration(kpis.slaProduccionMs)} hint="Liberado → listo" />
          <StatCard
            label="% comprobantes rechazados"
            value={kpis.pctComprobantesRechazados == null ? "—" : `${kpis.pctComprobantesRechazados.toFixed(0)}%`}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Pedidos por día (14 días)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pedidos" name="Pedidos" fill="hsl(var(--primary))" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Distribución por estado">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--chart-2))" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <Panel title="Atajos de colas">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/comercial">Cola comercial</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contable">Cola contable</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/carnicero">Cola carnicero</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/general/pedidos">Todos los pedidos</Link>
            </Button>
          </div>
        </Panel>
      </PageBody>
    </RoleLayout>
  );
}

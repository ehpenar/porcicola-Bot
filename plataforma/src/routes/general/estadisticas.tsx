import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, Panel } from "@/components/common/page";
import { STATUS_LABEL, formatDuration } from "@/lib/pedidos";
import { comprobantesStatsQueryOptions, pedidosQueryOptions, requireRole } from "@/lib/queries";
import { computeKpis, distribucionPorStatus, pedidosPorDia } from "@/lib/stats";

export const Route = createFileRoute("/general/estadisticas")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Estadísticas · Porcicola Ops" }] }),
  component: EstadisticasPage,
});

function EstadisticasPage() {
  const { me } = Route.useRouteContext();
  const pedidosQ = useQuery(pedidosQueryOptions("all"));
  const compsQ = useQuery(comprobantesStatsQueryOptions);
  const pedidos = pedidosQ.data ?? [];
  const kpis = computeKpis(pedidos, compsQ.data ?? []);
  const porDia = pedidosPorDia(pedidos, 14);
  const dist = distribucionPorStatus(pedidos).map((d) => ({ ...d, nombre: STATUS_LABEL[d.status] }));

  return (
    <RoleLayout me={me}>
      <PageHeader title="Estadísticas" description="SLA y volumen operativo." />
      <PageBody className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Panel title="SLA verificación">
            <p className="text-2xl font-semibold tabular">{formatDuration(kpis.slaVerificacionMs)}</p>
          </Panel>
          <Panel title="SLA pago">
            <p className="text-2xl font-semibold tabular">{formatDuration(kpis.slaPagoMs)}</p>
          </Panel>
          <Panel title="SLA producción">
            <p className="text-2xl font-semibold tabular">{formatDuration(kpis.slaProduccionMs)}</p>
          </Panel>
        </div>
        <Panel title="Pedidos y minutos de producción por día">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="produccionMin"
                  name="Prod. min (prom)"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Pedidos por estado">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </PageBody>
    </RoleLayout>
  );
}

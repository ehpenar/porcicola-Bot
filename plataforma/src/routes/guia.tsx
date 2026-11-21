import { createFileRoute } from "@tanstack/react-router";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, Panel } from "@/components/common/page";
import { requireRole } from "@/lib/queries";

export const Route = createFileRoute("/guia")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general", "comercial", "contable", "carnicero"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Guía rápida · Porcicola Ops" }] }),
  component: GuiaPage,
});

function GuiaPage() {
  const { me } = Route.useRouteContext();
  return (
    <RoleLayout me={me}>
      <PageHeader title="Guía rápida" description="Flujo feliz de un pedido (prepago) y botones canónicos." />
      <PageBody className="space-y-4">
        <Panel title="Flujo">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>El bot (o Comercial) crea el pedido en <strong>Capturado</strong>.</li>
            <li>
              <strong>Comercial</strong> revisa y pulsa <em>Verificar pedido</em>.
            </li>
            <li>
              El pedido aparece en Contable y en Carnicero como <em>Espera aprobación</em> (solo lectura para el carnicero).
            </li>
            <li>
              <strong>Contable</strong> pulsa <em>Solicitar pago al cliente</em> (WhatsApp simulado).
            </li>
            <li>Se adjunta el comprobante → Contable pulsa <em>Validar pago y liberar</em>.</li>
            <li>
              <strong>Carnicero</strong> trabaja y pulsa <em>Marcar listo para despacho</em>.
            </li>
            <li>
              Contable pulsa <em>Notificar cliente y archivar</em>. Queda en históricos.
            </li>
          </ol>
        </Panel>
        <Panel title="Botones canónicos">
          <ul className="space-y-1 font-mono text-sm">
            <li>Verificar pedido</li>
            <li>Solicitar pago al cliente</li>
            <li>Validar pago y liberar</li>
            <li>Marcar listo para despacho</li>
            <li>Notificar cliente y archivar</li>
          </ul>
        </Panel>
        <Panel title="Regla clave">
          <p className="text-sm text-muted-foreground">
            Un solo Pedido. Visible ≠ accionable: Carnicero puede ver temprano, pero solo actúa cuando Contable libera la producción.
          </p>
        </Panel>
      </PageBody>
    </RoleLayout>
  );
}

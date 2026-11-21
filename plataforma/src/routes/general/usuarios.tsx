import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RoleLayout } from "@/components/layout/role-layout";
import { PageBody, PageHeader, Panel } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { crearUsuario } from "@/lib/admin.functions";
import { isDemoMode } from "@/lib/demo-mode";
import { demoSetConfigPago, demoSetUserActive, demoSetUserRole, resetDemoData } from "@/lib/demo-store";
import { ROLE_LABEL, errorMessage, type AppRole } from "@/lib/pedidos";
import { configPagoQueryOptions, requireRole, usersQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/general/usuarios")({
  beforeLoad: async ({ context }) => {
    const me = await requireRole(context.queryClient, ["general"]);
    return { me };
  },
  head: () => ({ meta: [{ title: "Usuarios · Porcicola Ops" }] }),
  component: UsuariosPage,
});

const ROLES: AppRole[] = ["general", "comercial", "contable", "carnicero"];

function UsuariosPage() {
  const { me } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const usersQ = useQuery(usersQueryOptions);
  const configQ = useQuery(configPagoQueryOptions);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Porcicola123!");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("comercial");
  const [instrucciones, setInstrucciones] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [configHydrated, setConfigHydrated] = useState(false);

  useEffect(() => {
    if (configQ.data && !configHydrated) {
      setInstrucciones(configQ.data.instrucciones ?? "");
      setQrUrl(configQ.data.qr_url ?? "");
      setConfigHydrated(true);
    }
  }, [configQ.data, configHydrated]);

  const createM = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) throw new Error("En modo demo los 4 roles ya existen. Usa Cerrar sesión y entra con otro rol.");
      return crearUsuario({ data: { email, password, full_name: fullName, role } });
    },
    onSuccess: () => {
      toast.success("Usuario creado");
      setEmail("");
      setFullName("");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const roleM = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      if (isDemoMode()) {
        demoSetUserRole(userId, newRole);
        return;
      }
      const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const activeM = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      if (isDemoMode()) {
        demoSetUserActive(userId, active);
        return;
      }
      const { error } = await supabase.rpc("admin_set_active", { p_user: userId, p_active: active });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const configM = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        demoSetConfigPago(instrucciones, qrUrl);
        return;
      }
      const { error } = await supabase.rpc("actualizar_config_pago", {
        p_instrucciones: instrucciones,
        p_qr_url: qrUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instrucciones de pago guardadas");
      void queryClient.invalidateQueries({ queryKey: ["config-pago"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <RoleLayout me={me}>
      <PageHeader
        title="Usuarios y acceso"
        description="Crea cuentas, asigna roles y configura el mensaje de pago."
        actions={
          isDemoMode() ? (
            <Button
              variant="outline"
              onClick={() => {
                resetDemoData();
                void queryClient.invalidateQueries();
                toast.success("Datos demo reiniciados");
              }}
            >
              Reiniciar datos demo
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-6">
        {isDemoMode() && (
          <Panel title="Modo demo">
            <p className="text-sm text-muted-foreground">
              Auth y pedidos viven en este navegador (localStorage). Para cambiar de rol: Cerrar sesión → elegir otro perfil en login.
            </p>
          </Panel>
        )}
        <Panel title="Crear usuario">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createM.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="fn">Nombre</Label>
              <Input id="fn" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em">Correo</Label>
              <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Contraseña</Label>
              <Input id="pw" type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createM.isPending}>
                {createM.isPending ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Requiere clave de servicio de Supabase en el servidor. Si falla la creación, crea el usuario en Supabase Auth y asígnale el rol en esta tabla.
          </p>
        </Panel>

        <Panel title="Usuarios">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr className="[&>th]:label-caps [&>th]:px-2 [&>th]:py-2">
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Activo</th>
                </tr>
              </thead>
              <tbody>
                {(usersQ.data ?? []).map((u) => (
                  <tr key={u.id} className="border-b last:border-0 [&>td]:px-2 [&>td]:py-2">
                    <td className="font-medium">{u.full_name || "—"}</td>
                    <td className="font-mono text-xs">{u.email}</td>
                    <td>
                      <Select
                        value={u.role ?? undefined}
                        onValueChange={(v) => roleM.mutate({ userId: u.id, newRole: v as AppRole })}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue placeholder="Sin rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Switch
                        checked={u.active}
                        disabled={u.id === me.userId}
                        onCheckedChange={(active) => activeM.mutate({ userId: u.id, active })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Instrucciones de pago (WhatsApp)">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inst">Texto al solicitar pago</Label>
              <Textarea
                id="inst"
                rows={4}
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Cuenta Bancolombia, Nequi, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr">URL imagen QR (opcional)</Label>
              <Input id="qr" value={qrUrl} onChange={(e) => setQrUrl(e.target.value)} />
            </div>
            <Button onClick={() => configM.mutate()} disabled={configM.isPending}>
              Guardar instrucciones
            </Button>
          </div>
        </Panel>
      </PageBody>
    </RoleLayout>
  );
}

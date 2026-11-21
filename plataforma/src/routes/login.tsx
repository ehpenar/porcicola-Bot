import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Beef } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demo-mode";
import { DEMO_ACCOUNTS, loginDemoRole } from "@/lib/demo-store";
import { ROLE_HOME, ROLE_LABEL, errorMessage, type AppRole } from "@/lib/pedidos";
import { meQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me?.role && me.active) {
      throw redirect({ to: ROLE_HOME[me.role] });
    }
  },
  head: () => ({ meta: [{ title: "Iniciar sesión · Porcicola Ops" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const demo = isDemoMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function enterAs(role: AppRole) {
    setLoading(true);
    try {
      loginDemoRole(role);
      queryClient.removeQueries({ queryKey: ["me"] });
      const me = await queryClient.fetchQuery(meQueryOptions);
      toast.success(`Modo demo · ${ROLE_LABEL[role]}`);
      await navigate({ to: ROLE_HOME[me!.role!], replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      toast.message("Usa los botones de rol de abajo (modo demo activo).");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      queryClient.removeQueries({ queryKey: ["me"] });
      const me = await queryClient.fetchQuery(meQueryOptions);
      if (!me?.role || !me.active) {
        await supabase.auth.signOut();
        throw new Error("Tu cuenta no tiene un rol activo.");
      }
      toast.success(`Bienvenido, ${me.fullName || me.email}`);
      await navigate({ to: ROLE_HOME[me.role], replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-md bg-primary text-primary-foreground">
            <Beef className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Porcicola Ops</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {demo ? "Modo demo local (sin Supabase Auth)" : "Plataforma de operaciones"}
          </p>
        </div>

        {demo ? (
          <div className="space-y-3 rounded-md border bg-card p-6 shadow-card">
            <p className="text-sm text-muted-foreground">
              Entra con un rol para recorrer las vistas. Los datos son de prueba en este navegador.
            </p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <Button key={a.role} variant={a.role === "general" ? "default" : "outline"} disabled={loading} onClick={() => enterAs(a.role)}>
                  Entrar como {ROLE_LABEL[a.role]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-md border bg-card p-6 shadow-card">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({ meta: [{ title: "Sin acceso · Porcicola Ops" }] }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">
          Tu sesión no tiene un rol activo, o intentaste entrar a una vista que no te corresponde. Contacta al perfil General para que te asignen el rol correcto.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/login">Ir al login</Link>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
